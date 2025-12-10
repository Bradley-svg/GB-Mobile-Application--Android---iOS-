import { logger } from '../../config/logger';
import { insertAuditEvent, type CreateAuditEventInput } from './auditRepository';

export type AuditAction =
  | 'file_upload_success'
  | 'file_upload_failure'
  | 'file_signed_url_created'
  | 'file_signed_url_downloaded'
  | 'share_link_created'
  | 'share_link_revoked';

export async function recordAuditEvent(input: CreateAuditEventInput & { action: AuditAction }) {
  try {
    await insertAuditEvent(input);
  } catch (err) {
    logger.warn({ err, action: input.action, entityType: input.entityType }, 'failed to record audit event');
  }
}
