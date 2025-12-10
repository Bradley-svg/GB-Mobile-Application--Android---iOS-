import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordAuditEvent } from '../auditService';

const insertAuditEventMock = vi.fn();
const warnMock = vi.fn();

vi.mock('../auditRepository', () => ({
  insertAuditEvent: (...args: unknown[]) => insertAuditEventMock(...args),
}));

vi.mock('../../../config/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => warnMock(...args),
  },
}));

describe('recordAuditEvent', () => {
  beforeEach(() => {
    insertAuditEventMock.mockReset();
    warnMock.mockReset();
  });

  it('persists audit events via the repository', async () => {
    insertAuditEventMock.mockResolvedValueOnce({
      id: 'audit-1',
      org_id: 'org-1',
      user_id: 'user-1',
      action: 'file_upload_success',
      entity_type: 'file',
      entity_id: 'file-1',
      metadata: {},
      created_at: new Date().toISOString(),
    });

    await recordAuditEvent({
      orgId: 'org-1',
      userId: 'user-1',
      action: 'file_upload_success',
      entityType: 'file',
      entityId: 'file-1',
      metadata: { path: '/files/file-1' },
    });

    expect(insertAuditEventMock).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      action: 'file_upload_success',
      entityType: 'file',
      entityId: 'file-1',
      metadata: { path: '/files/file-1' },
    });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('logs a warning when persistence fails but does not throw', async () => {
    insertAuditEventMock.mockRejectedValueOnce(new Error('db down'));

    await recordAuditEvent({
      orgId: 'org-1',
      userId: null,
      action: 'share_link_revoked',
      entityType: 'share_link',
      entityId: 'share-1',
    });

    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        action: 'share_link_revoked',
        entityType: 'share_link',
      }),
      'failed to record audit event'
    );
  });
});
