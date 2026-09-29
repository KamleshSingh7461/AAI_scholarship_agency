import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Events,
  MANDATORY_ATHLETE_DOCUMENTS,
  normalizePhone,
  ProfileStatus,
  type ProfileReviewedEvent,
  type ProfileSubmittedEvent,
} from '@aci/contracts';
import { AuditService, InternalHttpClient, OutboxService, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import type { AcademicInfoDto, DocumentsDto, PersonalInfoDto, ReferencesDto, ReviewDto, SportsInfoDto, VerifyDocumentDto } from './dto';
import type { Prisma } from './generated/prisma';

const FULL = {
  academics: { orderBy: { level: 'asc' } },
  sports: true,
  documents: { orderBy: { type: 'asc' } },
  references: { orderBy: { position: 'asc' } },
} satisfies Prisma.AthleteProfileInclude;

export type FullProfile = Prisma.AthleteProfileGetPayload<{ include: typeof FULL }>;

const EDITABLE: string[] = [ProfileStatus.DRAFT, ProfileStatus.CHANGES_REQUESTED];

export function ageOn(dob: Date, on = new Date()): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

@Injectable()
export class AthleteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient,
    private readonly audit: AuditService,
  ) {}

  /** Returns the athlete's profile, creating an empty draft on first access. */
  async getOrCreate(user: AuthUser): Promise<FullProfile> {
    const existing = await this.prisma.athleteProfile.findUnique({ where: { userId: user.id }, include: FULL });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.athleteProfile.create({ data: { userId: user.id, phone: user.phone, whatsappNumber: user.phone } });
      return tx.athleteProfile.update({
        where: { id: p.id },
        data: { athleteCode: `AC-${String(p.athleteNumber).padStart(5, '0')}` },
        include: FULL,
      });
    });
  }

  private async editable(user: AuthUser): Promise<FullProfile> {
    const p = await this.getOrCreate(user);
    if (!EDITABLE.includes(p.status)) {
      throw new ConflictException({
        message: 'Your profile has been submitted and is locked. Contact support if something needs to change.',
        code: 'PROFILE_LOCKED',
      });
    }
    return p;
  }

  private markStep(steps: number[], step: number): number[] {
    return Array.from(new Set([...steps, step])).sort();
  }

  /** Ensures referenced document ids exist, finished uploading and belong to this athlete. */
  private async assertDocs(userId: string, ids: (string | null | undefined)[]) {
    const list = ids.filter((x): x is string => !!x);
    if (!list.length) return;
    const res = await this.http.post<{ id: string; ok: boolean }[]>('document', '/internal/documents/validate', { ids: list, ownerUserId: userId });
    const bad = res.filter((r) => !r.ok).map((r) => r.id);
    if (bad.length) throw new BadRequestException({ message: 'Some documents are missing or not uploaded yet', code: 'INVALID_DOCUMENTS', ids: bad });
  }

  async savePersonal(user: AuthUser, dto: PersonalInfoDto) {
    const p = await this.editable(user);
    await this.assertDocs(user.id, [dto.profilePhotoDocumentId]);
    const dob = new Date(dto.dateOfBirth);
    const age = ageOn(dob);
    if (age < 10 || age > 40) throw new BadRequestException({ message: 'Please check your date of birth', code: 'INVALID_DOB' });
    const whatsapp = dto.whatsappNumber ? normalizePhone(dto.whatsappNumber) : p.phone;
    if (!whatsapp) throw new BadRequestException({ message: 'Invalid WhatsApp number', code: 'INVALID_PHONE' });
    const guardianPhone = dto.guardianPhone ? normalizePhone(dto.guardianPhone) : null;
    if (age < 18 && (!dto.guardianName || !guardianPhone)) {
      throw new BadRequestException({
        message: 'Athletes under 18 must provide a parent/guardian name and phone. The guardian will co-sign the agreements.',
        code: 'GUARDIAN_REQUIRED',
      });
    }
    return this.prisma.athleteProfile.update({
      where: { id: p.id },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dateOfBirth: dob,
        gender: dto.gender,
        nationality: dto.nationality,
        profilePhotoDocumentId: dto.profilePhotoDocumentId,
        email: dto.email.toLowerCase(),
        whatsappNumber: whatsapp,
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        country: dto.country ?? 'India',
        guardianName: dto.guardianName,
        guardianRelation: dto.guardianRelation,
        guardianPhone,
        guardianEmail: dto.guardianEmail,
        stepsCompleted: this.markStep(p.stepsCompleted, 1),
      },
      include: FULL,
    });
  }

  async saveAcademic(user: AuthUser, dto: AcademicInfoDto) {
    const p = await this.editable(user);
    const levels = dto.records.map((r) => r.level);
    if (new Set(levels).size !== levels.length) throw new BadRequestException({ message: 'Each academic level can only appear once', code: 'DUPLICATE_LEVEL' });
    if (!levels.includes('HIGH_SCHOOL')) throw new BadRequestException({ message: 'High School (10th) details are required', code: 'HIGH_SCHOOL_REQUIRED' });
    await this.assertDocs(user.id, dto.records.map((r) => r.certificateDocumentId));
    return this.prisma.$transaction(async (tx) => {
      await tx.academicRecord.deleteMany({ where: { profileId: p.id } });
      await tx.academicRecord.createMany({ data: dto.records.map((r) => ({ ...r, profileId: p.id })) });
      return tx.athleteProfile.update({ where: { id: p.id }, data: { stepsCompleted: this.markStep(p.stepsCompleted, 2) }, include: FULL });
    });
  }

  async saveSports(user: AuthUser, dto: SportsInfoDto) {
    const p = await this.editable(user);
    await this.assertDocs(user.id, [dto.medicalClearanceDocumentId, dto.sportsIdDocumentId, dto.coachCertificationDocumentId]);
    if (dto.previousInjuries && !dto.injuryDetails) {
      throw new BadRequestException({ message: 'Please describe your previous injuries', code: 'INJURY_DETAILS_REQUIRED' });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.sportsProfile.upsert({ where: { profileId: p.id }, update: dto, create: { ...dto, profileId: p.id } });
      return tx.athleteProfile.update({ where: { id: p.id }, data: { stepsCompleted: this.markStep(p.stepsCompleted, 3) }, include: FULL });
    });
  }

  async saveDocuments(user: AuthUser, dto: DocumentsDto) {
    const p = await this.editable(user);
    await this.assertDocs(user.id, dto.documents.map((d) => d.documentId));
    return this.prisma.$transaction(async (tx) => {
      for (const d of dto.documents) {
        await tx.athleteDocument.upsert({
          where: { profileId_type: { profileId: p.id, type: d.type } },
          update: { documentId: d.documentId, verificationStatus: 'PENDING', verifiedAt: null, verifiedById: null, remarks: null },
          create: { profileId: p.id, type: d.type, documentId: d.documentId },
        });
      }
      const photo = dto.documents.find((d) => d.type === 'PROFILE_PHOTO');
      return tx.athleteProfile.update({
        where: { id: p.id },
        data: photo ? { profilePhotoDocumentId: photo.documentId } : {},
        include: FULL,
      });
    });
  }

  async saveReferences(user: AuthUser, dto: ReferencesDto) {
    const p = await this.editable(user);
    if (!dto.references.some((r) => r.position === 1)) throw new BadRequestException({ message: 'Reference 1 is required', code: 'REFERENCE_REQUIRED' });
    await this.assertDocs(user.id, dto.references.map((r) => r.certificationDocumentId));
    return this.prisma.$transaction(async (tx) => {
      await tx.athleteReference.deleteMany({ where: { profileId: p.id } });
      await tx.athleteReference.createMany({
        data: dto.references.map((r) => ({ ...r, phone: normalizePhone(r.phone) ?? r.phone, profileId: p.id })),
      });
      return tx.athleteProfile.update({ where: { id: p.id }, data: { stepsCompleted: this.markStep(p.stepsCompleted, 4) }, include: FULL });
    });
  }

  completeness(p: FullProfile) {
    const missing: string[] = [];
    const step1 = !!(p.firstName && p.lastName && p.dateOfBirth && p.gender && p.nationality && p.email && p.addressLine && p.city && p.state && p.zipCode);
    if (!step1) missing.push('Personal info (Step 1)');
    const minor = p.dateOfBirth ? ageOn(p.dateOfBirth) < 18 : false;
    if (minor && !(p.guardianName && p.guardianPhone)) missing.push('Guardian details (athlete is under 18)');
    const step2 = p.academics.some((a) => a.level === 'HIGH_SCHOOL');
    if (!step2) missing.push('Academic info (Step 2)');
    const step3 = !!p.sports?.primarySport;
    if (!step3) missing.push('Sports metrics (Step 3)');
    const types = new Set(p.documents.map((d) => d.type));
    const missingDocs = MANDATORY_ATHLETE_DOCUMENTS.filter((t) => !types.has(t));
    if (missingDocs.length) missing.push(`Mandatory documents: ${missingDocs.join(', ')}`);
    const step4 = !missingDocs.length && p.references.some((r) => r.position === 1);
    if (!p.references.some((r) => r.position === 1)) missing.push('Reference 1');
    return {
      steps: { personal: step1, academic: step2, sports: step3, documents: step4 },
      missing,
      missingDocuments: missingDocs,
      isMinor: minor,
      canSubmit: missing.length === 0 && EDITABLE.includes(p.status),
    };
  }

  async submit(user: AuthUser) {
    const p = await this.editable(user);
    const c = this.completeness(p);
    if (c.missing.length) throw new BadRequestException({ message: 'Your profile is incomplete', code: 'PROFILE_INCOMPLETE', missing: c.missing });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.athleteProfile.update({
        where: { id: p.id },
        data: { status: ProfileStatus.SUBMITTED, submittedAt: new Date() },
        include: FULL,
      });
      await this.outbox.add<ProfileSubmittedEvent>(tx, Events.ProfileSubmitted, {
        userId: p.userId,
        profileId: p.id,
        athleteCode: p.athleteCode!,
        fullName: `${p.firstName} ${p.lastName}`,
      });
      return updated;
    });
  }

  async review(id: string, dto: ReviewDto, actor: AuthUser) {
    const p = await this.prisma.athleteProfile.findUnique({ where: { id }, include: FULL });
    if (!p) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (p.status === ProfileStatus.DRAFT) throw new ConflictException({ message: 'Profile has not been submitted yet', code: 'NOT_SUBMITTED' });
    if (dto.decision === 'VERIFIED' && p.documents.some((d) => MANDATORY_ATHLETE_DOCUMENTS.includes(d.type as any) && d.verificationStatus !== 'VERIFIED')) {
      throw new ConflictException({ message: 'Verify all mandatory documents before verifying the profile', code: 'DOCUMENTS_UNVERIFIED' });
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.athleteProfile.update({
        where: { id },
        data: { status: dto.decision, reviewedAt: new Date(), reviewedById: actor.id, reviewRemarks: dto.remarks },
        include: FULL,
      });
      await this.outbox.add<ProfileReviewedEvent>(tx, Events.ProfileReviewed, {
        userId: p.userId,
        profileId: p.id,
        status: dto.decision,
        remarks: dto.remarks,
      });
      await this.audit.log(actor, { action: `profile.${dto.decision.toLowerCase()}`, entityType: 'AthleteProfile', entityId: id, before: { status: p.status }, after: { status: dto.decision, remarks: dto.remarks } }, tx);
      return updated;
    });
  }

  async verifyDocument(profileId: string, docRowId: string, dto: VerifyDocumentDto, actor: AuthUser) {
    const row = await this.prisma.athleteDocument.findFirst({ where: { id: docRowId, profileId } });
    if (!row) throw new NotFoundException({ message: 'Document not found', code: 'NOT_FOUND' });
    const updated = await this.prisma.athleteDocument.update({
      where: { id: docRowId },
      data: { verificationStatus: dto.verificationStatus, remarks: dto.remarks, verifiedById: actor.id, verifiedAt: new Date() },
    });
    await this.audit.log(actor, { action: 'document.verify', entityType: 'AthleteDocument', entityId: docRowId, before: { status: row.verificationStatus }, after: dto });
    return updated;
  }
}
