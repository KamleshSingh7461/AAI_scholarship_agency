import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  convert,
  Events,
  quoteFee,
  type Currency,
  type FeeConfig,
} from '@aci/contracts';
import { AuditService, OutboxService, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { FxClient } from './fx.client';
import type { CreateProgramDto, UpdateProgramDto } from './dto';
import type { Prisma, ScholarshipProgram, University } from './generated/prisma';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Per-year value components that form part of the award (anything the student pays is excluded). */
export function programValue(p: ScholarshipProgram) {
  const part = (amount: bigint, bearer: string) => (bearer === 'STUDENT' ? 0 : n(amount));
  const tuition = part(p.tuitionPerYear, p.tuitionBorneBy);
  const room = part(p.roomPerYear, p.roomBorneBy);
  const food = part(p.foodPerYear, p.foodBorneBy);
  const other = part(p.otherPerYear, p.otherBorneBy);
  const annual = tuition + room + food + other;
  return {
    currency: p.currency as Currency,
    tuitionPerYear: tuition,
    roomPerYear: room,
    foodPerYear: food,
    otherPerYear: other,
    annualValue: annual,
    totalValue: annual * p.durationYears,
    universityFundedAnnual:
      (p.tuitionBorneBy === 'UNIVERSITY' ? tuition : 0) +
      (p.roomBorneBy === 'UNIVERSITY' ? room : 0) +
      (p.foodBorneBy === 'UNIVERSITY' ? food : 0) +
      (p.otherBorneBy === 'UNIVERSITY' ? other : 0),
    companyFundedAnnual:
      (p.tuitionBorneBy === 'COMPANY' ? tuition : 0) +
      (p.roomBorneBy === 'COMPANY' ? room : 0) +
      (p.foodBorneBy === 'COMPANY' ? food : 0) +
      (p.otherBorneBy === 'COMPANY' ? other : 0),
  };
}

export function feeConfig(p: ScholarshipProgram): FeeConfig {
  return {
    feeType: p.feeType as FeeConfig['feeType'],
    feeFlatInr: n(p.feeFlatInr),
    feePercentBps: p.feePercentBps,
    feePercentBase: p.feePercentBase as FeeConfig['feePercentBase'],
    feeMinInr: n(p.feeMinInr),
    feeMaxInr: n(p.feeMaxInr),
    taxBps: p.taxBps,
  };
}

export function isOpen(p: ScholarshipProgram, now = new Date()): boolean {
  if (p.status !== 'PUBLISHED') return false;
  if (p.applicationOpensAt && p.applicationOpensAt > now) return false;
  if (p.applicationClosesAt && p.applicationClosesAt < now) return false;
  return p.seatsReserved + p.seatsAwarded < p.seatsTotal;
}

@Injectable()
export class ProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxClient,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Full representation incl. computed values in native currency, INR and USD, plus the fee quote. */
  async present(p: ScholarshipProgram & { university?: University | null }, rate4?: number) {
    const r = rate4 ?? (await this.fx.usdInrRate4());
    const v = programValue(p);
    const toInr = (x: number) => convert(x, v.currency, 'INR', r);
    const toUsd = (x: number) => convert(x, v.currency, 'USD', r);
    const fee = quoteFee(feeConfig(p), { annualValue: v.annualValue, totalValue: v.totalValue, currency: v.currency }, r);
    return {
      ...p,
      value: {
        ...v,
        inr: { annualValue: toInr(v.annualValue), totalValue: toInr(v.totalValue), tuitionPerYear: toInr(v.tuitionPerYear), roomPerYear: toInr(v.roomPerYear), foodPerYear: toInr(v.foodPerYear), otherPerYear: toInr(v.otherPerYear) },
        usd: { annualValue: toUsd(v.annualValue), totalValue: toUsd(v.totalValue) },
        usdInrRate4: r,
      },
      fee,
      seatsLeft: Math.max(0, p.seatsTotal - p.seatsReserved - p.seatsAwarded),
      isOpen: isOpen(p),
    };
  }

  private computeTuition(full: number, bps: number): bigint {
    return BigInt(Math.round((full * bps) / 10000));
  }

  private async assertAllocationCapacity(allocationId: string, seatsDelta: number, excludeProgramId?: string) {
    const alloc = await this.prisma.scholarshipAllocation.findUnique({ where: { id: allocationId }, include: { programs: true } });
    if (!alloc) throw new BadRequestException({ message: 'Allocation not found', code: 'ALLOCATION_NOT_FOUND' });
    if (alloc.status !== 'OPEN') throw new ConflictException({ message: 'This allocation is closed', code: 'ALLOCATION_CLOSED' });
    const used = alloc.programs.filter((p) => p.id !== excludeProgramId && p.status !== 'ARCHIVED').reduce((s, p) => s + p.seatsTotal, 0);
    const capacity = alloc.totalSeats + alloc.rolledOverSeats;
    if (used + seatsDelta > capacity) {
      throw new ConflictException({
        message: `The ${alloc.academicYear} allocation has ${capacity - used} seats left to assign to programs`,
        code: 'ALLOCATION_EXCEEDED',
      });
    }
    return alloc;
  }

  async create(dto: CreateProgramDto, actor: AuthUser) {
    const uni = await this.prisma.university.findUnique({ where: { id: dto.universityId } });
    if (!uni) throw new BadRequestException({ message: 'University not found', code: 'UNIVERSITY_NOT_FOUND' });
    if (dto.allocationId) {
      const alloc = await this.assertAllocationCapacity(dto.allocationId, dto.seatsTotal);
      if (alloc.universityId !== dto.universityId) throw new BadRequestException({ message: 'Allocation belongs to another university' });
    }
    this.validateFee(dto);
    const code = `${(uni.shortName ?? uni.name).replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase()}-${dto.durationYears}Y-${dto.academicYear.slice(2, 4)}${dto.academicYear.slice(5, 7)}-${randomInt(100, 999)}`;
    const slug = `${slugify(uni.shortName ?? uni.name)}-${slugify(dto.name)}-${code.slice(-3)}`;
    const p = await this.prisma.scholarshipProgram.create({
      data: {
        ...(this.mapDto(dto) as Prisma.ScholarshipProgramUncheckedCreateInput),
        universityId: dto.universityId,
        allocationId: dto.allocationId,
        name: dto.name,
        durationYears: dto.durationYears,
        academicYear: dto.academicYear,
        seatsTotal: dto.seatsTotal,
        code,
        slug,
        createdById: actor.id,
      },
      include: { university: true },
    });
    await this.audit.log(actor, { action: 'program.create', entityType: 'ScholarshipProgram', entityId: p.id, after: p });
    return this.present(p);
  }

  async update(id: string, dto: UpdateProgramDto, actor: AuthUser) {
    const before = await this.prisma.scholarshipProgram.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ message: 'Program not found', code: 'NOT_FOUND' });
    const committed = before.seatsReserved + before.seatsAwarded;
    if (dto.seatsTotal !== undefined && dto.seatsTotal < committed) {
      throw new ConflictException({ message: `Cannot reduce seats below ${committed} already reserved/awarded`, code: 'SEATS_IN_USE' });
    }
    // Once anyone holds or has been awarded a seat, the valuation terms are frozen (they are in signed agreements).
    const valuationKeys = ['currency', 'tuitionFullPerYear', 'tuitionCoverageBps', 'roomPerYear', 'foodPerYear', 'otherPerYear', 'durationYears', 'tuitionBorneBy', 'roomBorneBy', 'foodBorneBy', 'otherBorneBy'];
    if (committed > 0 && valuationKeys.some((k) => (dto as any)[k] !== undefined)) {
      throw new ConflictException({ message: 'Scholarship value and duration cannot change after seats are reserved or awarded. Create a new program instead.', code: 'VALUATION_FROZEN' });
    }
    const allocationId = dto.allocationId ?? before.allocationId;
    if (allocationId && (dto.seatsTotal !== undefined || dto.allocationId)) {
      await this.assertAllocationCapacity(allocationId, dto.seatsTotal ?? before.seatsTotal, id);
    }
    const merged = { ...before, ...dto } as any;
    this.validateFee(merged);
    const p = await this.prisma.scholarshipProgram.update({
      where: { id },
      data: {
        ...this.mapDto(merged),
        name: dto.name,
        allocationId: dto.allocationId,
        durationYears: dto.durationYears,
        academicYear: dto.academicYear,
        seatsTotal: dto.seatsTotal,
      },
      include: { university: true },
    });
    await this.audit.log(actor, { action: 'program.update', entityType: 'ScholarshipProgram', entityId: id, before, after: p });
    return this.present(p);
  }

  private validateFee(dto: { feeType: string; feeFlatInr?: number | bigint; feePercentBps?: number }) {
    if (dto.feeType === 'FLAT' && !(Number(dto.feeFlatInr ?? 0) > 0)) {
      throw new BadRequestException({ message: 'Flat fee amount is required', code: 'FEE_INVALID' });
    }
    if (dto.feeType === 'PERCENTAGE' && !((dto.feePercentBps ?? 0) > 0)) {
      throw new BadRequestException({ message: 'Fee percentage is required', code: 'FEE_INVALID' });
    }
  }

  private mapDto(d: Partial<CreateProgramDto> & Record<string, any>): Prisma.ScholarshipProgramUncheckedUpdateInput {
    const big = (v: any) => (v === undefined || v === null ? undefined : BigInt(v));
    const date = (v: any) => (v ? new Date(v) : v === null ? null : undefined);
    const out: Prisma.ScholarshipProgramUncheckedUpdateInput = {
      description: d.description,
      scholarshipType: d.scholarshipType,
      coverageType: d.coverageType,
      intakeDate: date(d.intakeDate),
      applicationOpensAt: date(d.applicationOpensAt),
      applicationClosesAt: date(d.applicationClosesAt),
      eligibleSports: d.eligibleSports,
      eligibilityCriteria: d.eligibilityCriteria,
      minAge: d.minAge,
      maxAge: d.maxAge,
      genderEligibility: d.genderEligibility,
      courses: d.courses,
      currency: d.currency,
      tuitionFullPerYear: big(d.tuitionFullPerYear),
      tuitionCoverageBps: d.tuitionCoverageBps,
      roomPerYear: big(d.roomPerYear),
      foodPerYear: big(d.foodPerYear),
      otherPerYear: big(d.otherPerYear),
      otherCostsNote: d.otherCostsNote,
      tuitionBorneBy: d.tuitionBorneBy,
      roomBorneBy: d.roomBorneBy,
      foodBorneBy: d.foodBorneBy,
      otherBorneBy: d.otherBorneBy,
      feeType: d.feeType,
      feeFlatInr: big(d.feeFlatInr),
      feePercentBps: d.feePercentBps,
      feePercentBase: d.feePercentBase,
      feeMinInr: big(d.feeMinInr),
      feeMaxInr: big(d.feeMaxInr),
      taxBps: d.taxBps,
      feeRefundableOnRejection: d.feeRefundableOnRejection,
      commissionBps: d.commissionBps,
      universityCommissionShareBps: d.universityCommissionShareBps,
    };
    if (d.tuitionFullPerYear !== undefined && d.tuitionCoverageBps !== undefined) {
      out.tuitionPerYear = this.computeTuition(Number(d.tuitionFullPerYear), Number(d.tuitionCoverageBps));
    }
    return out;
  }

  async setStatus(id: string, status: 'PUBLISHED' | 'CLOSED' | 'ARCHIVED' | 'DRAFT', actor: AuthUser) {
    const p = await this.prisma.scholarshipProgram.findUnique({ where: { id }, include: { university: true } });
    if (!p) throw new NotFoundException({ message: 'Program not found', code: 'NOT_FOUND' });
    if (status === 'PUBLISHED') {
      const v = programValue(p);
      if (v.annualValue <= 0) throw new BadRequestException({ message: 'Set the scholarship value before publishing', code: 'VALUE_REQUIRED' });
      if (p.university.status !== 'ACTIVE') throw new ConflictException({ message: 'University is inactive', code: 'UNIVERSITY_INACTIVE' });
    }
    if (status === 'ARCHIVED' && p.seatsReserved > 0) {
      throw new ConflictException({ message: 'Program has reserved seats pending signature', code: 'SEATS_IN_USE' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.scholarshipProgram.update({
        where: { id },
        data: { status, publishedAt: status === 'PUBLISHED' ? (p.publishedAt ?? new Date()) : p.publishedAt },
        include: { university: true },
      });
      if (status === 'PUBLISHED' && p.status !== 'PUBLISHED') {
        await this.outbox.add(tx, Events.ProgramPublished, { programId: id, universityId: p.universityId, name: p.name });
      }
      await this.audit.log(actor, { action: `program.${status.toLowerCase()}`, entityType: 'ScholarshipProgram', entityId: id, before: { status: p.status }, after: { status } }, tx);
      return u;
    });
    return this.present(updated);
  }
}
