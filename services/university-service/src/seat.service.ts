import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { isOpen } from './program.service';

/**
 * Seat inventory. All counter changes are single conditional UPDATEs so concurrent
 * approvals can never award more seats than the program has.
 */
@Injectable()
export class SeatService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(programId: string, applicationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.seatReservation.findUnique({ where: { applicationId } });
      if (existing && existing.status !== 'RELEASED') return existing; // idempotent
      const program = await tx.scholarshipProgram.findUnique({ where: { id: programId } });
      if (!program) throw new NotFoundException({ message: 'Program not found', code: 'NOT_FOUND' });
      if (program.status !== 'PUBLISHED' && program.status !== 'CLOSED') {
        throw new ConflictException({ message: 'Program is not active', code: 'PROGRAM_INACTIVE' });
      }
      const updated = await tx.$executeRaw`
        UPDATE scholarship_programs SET "seatsReserved" = "seatsReserved" + 1, "updatedAt" = now()
        WHERE id = ${programId}::uuid AND "seatsReserved" + "seatsAwarded" < "seatsTotal"`;
      if (updated !== 1) throw new ConflictException({ message: 'No seats left in this program', code: 'NO_SEATS' });
      if (existing) {
        return tx.seatReservation.update({
          where: { applicationId },
          data: { status: 'HELD', heldAt: new Date(), releasedAt: null, releaseReason: null, programId },
        });
      }
      return tx.seatReservation.create({ data: { programId, applicationId } });
    });
  }

  async confirm(applicationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.seatReservation.findUnique({ where: { applicationId } });
      if (!r) throw new NotFoundException({ message: 'No seat reservation for this application', code: 'NO_RESERVATION' });
      if (r.status === 'CONFIRMED') return r;
      if (r.status !== 'HELD') throw new ConflictException({ message: 'Seat reservation was released', code: 'RESERVATION_RELEASED' });
      await tx.$executeRaw`
        UPDATE scholarship_programs SET "seatsReserved" = "seatsReserved" - 1, "seatsAwarded" = "seatsAwarded" + 1, "updatedAt" = now()
        WHERE id = ${r.programId}::uuid`;
      return tx.seatReservation.update({ where: { applicationId }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    });
  }

  /** Releases a held seat, or (with `returnAwarded`) gives back a confirmed seat when an award is revoked. */
  async release(applicationId: string, reason: string, returnAwarded = false) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.seatReservation.findUnique({ where: { applicationId } });
      if (!r || r.status === 'RELEASED') return r;
      if (r.status === 'HELD') {
        await tx.$executeRaw`UPDATE scholarship_programs SET "seatsReserved" = "seatsReserved" - 1, "updatedAt" = now() WHERE id = ${r.programId}::uuid`;
      } else if (r.status === 'CONFIRMED') {
        if (!returnAwarded) return r;
        await tx.$executeRaw`UPDATE scholarship_programs SET "seatsAwarded" = "seatsAwarded" - 1, "updatedAt" = now() WHERE id = ${r.programId}::uuid`;
      }
      return tx.seatReservation.update({ where: { applicationId }, data: { status: 'RELEASED', releasedAt: new Date(), releaseReason: reason } });
    });
  }

  async canApply(programId: string) {
    const p = await this.prisma.scholarshipProgram.findUnique({ where: { id: programId } });
    return !!p && isOpen(p);
  }
}
