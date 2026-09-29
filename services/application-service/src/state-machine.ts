import { ConflictException, Injectable } from '@nestjs/common';
import { APPLICATION_TRANSITIONS, Events, type ApplicationStatus, type ApplicationStatusChangedEvent } from '@aci/contracts';
import { OutboxService, type AuthUser } from '@aci/nest-common';
import type { Application, Prisma } from './generated/prisma';

@Injectable()
export class ApplicationStateMachine {
  constructor(private readonly outbox: OutboxService) {}

  /**
   * Moves an application to `to`, enforcing the state machine and optimistic concurrency
   * (the row must still be in the status we read). Writes history and emits an event.
   */
  async transition(
    tx: Prisma.TransactionClient,
    app: Application,
    to: ApplicationStatus,
    actor: AuthUser | null,
    note?: string,
    extra: Prisma.ApplicationUpdateManyMutationInput = {},
  ): Promise<Application> {
    const from = app.status as ApplicationStatus;
    if (!APPLICATION_TRANSITIONS[from]?.includes(to)) {
      throw new ConflictException({ message: `Cannot move an application from ${from} to ${to}`, code: 'INVALID_TRANSITION' });
    }
    const res = await tx.application.updateMany({ where: { id: app.id, status: from }, data: { ...extra, status: to } });
    if (res.count !== 1) throw new ConflictException({ message: 'Application was changed by someone else, please reload', code: 'STALE' });
    await tx.applicationStatusHistory.create({
      data: { applicationId: app.id, fromStatus: from, toStatus: to, actorId: actor?.id, actorRole: actor?.role ?? 'SYSTEM', note },
    });
    await this.outbox.add<ApplicationStatusChangedEvent>(tx, Events.ApplicationStatusChanged, {
      applicationId: app.id,
      applicationNo: app.applicationNo,
      athleteUserId: app.athleteUserId,
      programId: app.programId,
      universityId: app.universityId,
      from,
      to,
      note,
    });
    return tx.application.findUniqueOrThrow({ where: { id: app.id } });
  }
}
