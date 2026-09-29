/**
 * Prisma schema fragment every service includes (copied into each schema.prisma).
 * Kept here as the reference definition for the outbox/inbox/audit tables that
 * nest-common's OutboxService, EventConsumerService and AuditService rely on.
 */
export const PRISMA_COMMON_MODELS = `
model OutboxEvent {
  id          String    @id @db.Uuid
  type        String
  payload     Json
  createdAt   DateTime  @default(now()) @map("created_at")
  publishedAt DateTime? @map("published_at")
  attempts    Int       @default(0)
  lastError   String?   @map("last_error")

  @@index([publishedAt, createdAt])
  @@map("outbox_events")
}

model ProcessedEvent {
  eventId     String   @map("event_id") @db.Uuid
  handler     String
  processedAt DateTime @default(now()) @map("processed_at")

  @@id([eventId, handler])
  @@map("processed_events")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String?  @map("actor_id")
  actorRole  String?  @map("actor_role")
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
`;
