import { query } from '../../config/db';

export type AuditEventRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateAuditEventInput = {
  orgId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function insertAuditEvent(input: CreateAuditEventInput): Promise<AuditEventRow> {
  const res = await query<AuditEventRow>(
    `
    insert into audit_events (org_id, user_id, action, entity_type, entity_id, metadata, created_at)
    values ($1, $2, $3, $4, $5, $6, now())
    returning *
  `,
    [
      input.orgId,
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.metadata ?? {},
    ]
  );

  return res.rows[0];
}
