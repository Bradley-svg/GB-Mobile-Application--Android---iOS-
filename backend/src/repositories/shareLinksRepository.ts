import { query } from '../config/db';

export type ShareLinkRow = {
  id: string;
  org_id: string;
  created_by_user_id: string;
  scope_type: 'site' | 'device';
  scope_id: string;
  token: string;
  permissions: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  created_by_email?: string | null;
  created_by_name?: string | null;
};

export async function createShareLink(
  orgId: string,
  createdByUserId: string,
  scopeType: 'site' | 'device',
  scopeId: string,
  expiresAt: Date,
  permissions: string,
  token: string
) {
  const res = await query<ShareLinkRow>(
    `
    insert into share_links (org_id, created_by_user_id, scope_type, scope_id, expires_at, permissions, token)
    values ($1, $2, $3, $4, $5, $6, $7)
    returning *
  `,
    [orgId, createdByUserId, scopeType, scopeId, expiresAt, permissions, token]
  );
  return res.rows[0];
}

export async function getShareLinkByToken(token: string): Promise<ShareLinkRow | null> {
  const res = await query<ShareLinkRow>(
    `
    select *
    from share_links
    where token = $1
      and expires_at > now()
      and (revoked_at is null or revoked_at > now())
  `,
    [token]
  );
  return res.rows[0] ?? null;
}

export async function listShareLinksForScope(
  orgId: string,
  scopeType: 'site' | 'device',
  scopeId: string
): Promise<ShareLinkRow[]> {
  const res = await query<ShareLinkRow>(
    `
    select sl.*, u.email as created_by_email, u.name as created_by_name
    from share_links sl
    left join users u on u.id = sl.created_by_user_id
    where sl.org_id = $1
      and sl.scope_type = $2
      and sl.scope_id = $3
      and sl.expires_at > now()
      and (sl.revoked_at is null or sl.revoked_at > now())
    order by sl.created_at desc
  `,
    [orgId, scopeType, scopeId]
  );
  return res.rows;
}

export async function revokeShareLink(orgId: string, id: string): Promise<ShareLinkRow | null> {
  const res = await query<ShareLinkRow>(
    `
    update share_links
    set revoked_at = now(),
        expires_at = least(expires_at, now())
    where org_id = $1 and id = $2
    returning *
  `,
    [orgId, id]
  );
  return res.rows[0] ?? null;
}
