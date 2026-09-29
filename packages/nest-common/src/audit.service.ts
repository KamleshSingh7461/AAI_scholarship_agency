import { Inject, Injectable } from '@nestjs/common';
import { PRISMA } from './tokens';
import type { AuthUser } from './auth/decorators';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/**
 * Append-only audit trail of staff actions, stored in each service's own audit_logs table.
 * Pass the transaction client so the audit row commits atomically with the change.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly prisma: any) {}

  async log(actor: AuthUser | undefined, entry: AuditEntry, tx?: any): Promise<void> {
    const db = tx ?? this.prisma;
    if (!db.auditLog) return;
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? 'SYSTEM',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as any,
        after: (entry.after ?? undefined) as any,
        ip: entry.ip ?? null,
      },
    });
  }
}
