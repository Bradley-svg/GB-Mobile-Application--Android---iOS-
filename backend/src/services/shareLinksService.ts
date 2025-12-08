import { randomBytes } from 'crypto';
import {
  createShareLink,
  getShareLinkByToken,
  listShareLinksForScope,
  revokeShareLink,
  type ShareLinkRow,
} from '../repositories/shareLinksRepository';
import { getDeviceById } from './deviceService';
import { getDevicesForSite, getSiteById } from './siteService';
import { getUserContext, requireOrganisationId, type UserContext } from './userService';
import { canShareReadOnly } from './rbacService';
import { getDeviceLastSeen } from '../repositories/devicesRepository';
import { getDeviceTelemetry } from './telemetryService';

const MAX_EXPIRY_DAYS = 90;

export type ShareLinkDto = {
  id: string;
  scopeType: 'site' | 'device';
  scopeId: string;
  permissions: string;
  expiresAt: string;
  createdAt: string;
  token: string;
  revokedAt?: string;
  createdBy?: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
};

export type PublicShareSummary = {
  scopeType: 'site' | 'device';
  scopeId: string;
  permissions: string;
  expiresAt: string;
};

export class ShareLinkError extends Error {
  reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'ShareLinkError';
  }
}

function mapShareLink(row: ShareLinkRow): ShareLinkDto {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    permissions: row.permissions,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    token: row.token,
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : undefined,
    createdBy: row.created_by_user_id
      ? {
          id: row.created_by_user_id,
          email: row.created_by_email,
          name: row.created_by_name,
        }
      : undefined,
  };
}

function mapPublicShare(row: ShareLinkRow): PublicShareSummary {
  return {
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    permissions: row.permissions,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
  };
}

function parseExpiresAt(input: string | Date): Date {
  if (input instanceof Date) return input;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new ShareLinkError('INVALID_EXPIRY', 'expiresAt must be a valid date');
  }
  return parsed;
}

function validateExpiry(expiresAt: Date) {
  const now = Date.now();
  if (expiresAt.getTime() <= now) {
    throw new ShareLinkError('INVALID_EXPIRY', 'Expiry must be in the future');
  }

  const maxExpiry = now + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  if (expiresAt.getTime() > maxExpiry) {
    throw new ShareLinkError('INVALID_EXPIRY', `Expiry cannot exceed ${MAX_EXPIRY_DAYS} days`);
  }
}

async function resolveUser(userId: string): Promise<UserContext> {
  const user = await getUserContext(userId);
  if (!user) {
    throw new ShareLinkError('UNAUTHORIZED', 'User not found');
  }
  return user;
}

function assertCanShare(user: UserContext) {
  if (!canShareReadOnly(user)) {
    throw new ShareLinkError('FORBIDDEN', 'You are not allowed to create share links');
  }
}

function getOrgId(user: UserContext) {
  try {
    return requireOrganisationId(user);
  } catch {
    throw new ShareLinkError('FORBIDDEN', 'User is not assigned to an organisation');
  }
}

function extractMetricSummary(data: any) {
  if (!data) return null;
  const metrics = data.metrics || data.raw?.sensor || {};
  const powerKw =
    metrics.power_kw ??
    (typeof metrics.power_w === 'number' ? metrics.power_w / 1000 : undefined) ??
    null;
  const flowRate =
    metrics.flow_rate ??
    metrics.flow_lps ??
    metrics.flow_lpm ??
    (typeof metrics.flow === 'number' ? metrics.flow : undefined) ??
    null;

  const summary = {
    supply_temp:
      typeof metrics.supply_temp === 'number'
        ? metrics.supply_temp
        : typeof metrics.supply_temperature_c === 'number'
        ? metrics.supply_temperature_c
        : null,
    return_temp:
      typeof metrics.return_temp === 'number'
        ? metrics.return_temp
        : typeof metrics.return_temperature_c === 'number'
        ? metrics.return_temperature_c
        : null,
    power_kw: typeof powerKw === 'number' ? powerKw : null,
    flow_rate: typeof flowRate === 'number' ? flowRate : null,
    cop: typeof metrics.cop === 'number' ? metrics.cop : null,
  };

  return summary;
}

async function buildSitePayload(link: ShareLinkRow) {
  const site = await getSiteById(link.scope_id, link.org_id);
  if (!site) {
    throw new ShareLinkError('NOT_FOUND', 'Site not found for this share link');
  }

  const devices = await getDevicesForSite(site.id, link.org_id);
  const snapshots = await getDeviceLastSeen(devices.map((d) => d.id));
  const snapshotByDevice = new Map(snapshots.map((snap) => [snap.id, snap]));

  return {
    share: mapPublicShare(link),
    site: {
      id: site.id,
      name: site.name,
      city: site.city,
      status: site.status,
      last_seen_at: site.last_seen_at,
      health: site.health,
      last_seen: site.last_seen,
      device_count: site.device_count,
      device_count_online: site.device_count_online,
    },
    devices: devices.map((device) => {
      const snapshot = snapshotByDevice.get(device.id);
      return {
        id: device.id,
        site_id: device.site_id,
        name: device.name,
        status: device.status,
        connectivity_status: device.connectivity_status,
        last_seen_at: device.last_seen_at,
        health: device.health,
        last_seen: device.last_seen,
        metrics: snapshot ? extractMetricSummary(snapshot.data) : null,
      };
    }),
  };
}

async function buildDevicePayload(link: ShareLinkRow) {
  const device = await getDeviceById(link.scope_id, link.org_id);
  if (!device) {
    throw new ShareLinkError('NOT_FOUND', 'Device not found for this share link');
  }

  const [snapshot] = await getDeviceLastSeen([device.id]);
  let telemetry = null;
  try {
    telemetry = await getDeviceTelemetry(device.id, '24h', 200);
  } catch {
    telemetry = null;
  }

  return {
    share: mapPublicShare(link),
    device: {
      id: device.id,
      site_id: device.site_id,
      name: device.name,
      status: device.status,
      connectivity_status: device.connectivity_status,
      last_seen_at: device.last_seen_at,
      health: device.health,
      last_seen: device.last_seen,
      metrics: snapshot ? extractMetricSummary(snapshot.data) : null,
    },
    telemetry,
  };
}

export async function createShareLinkForSite(
  userId: string,
  siteId: string,
  expiresAtInput: string | Date,
  permissions = 'read_only'
): Promise<ShareLinkDto> {
  const user = await resolveUser(userId);
  assertCanShare(user);
  const orgId = getOrgId(user);
  const site = await getSiteById(siteId, orgId);
  if (!site) {
    throw new ShareLinkError('NOT_FOUND', 'Site not found');
  }

  const perms = permissions ?? 'read_only';
  if (perms !== 'read_only') {
    throw new ShareLinkError('INVALID_PERMISSIONS', 'Only read-only share links are supported');
  }

  const expiresAt = parseExpiresAt(expiresAtInput);
  validateExpiry(expiresAt);
  const token = randomBytes(24).toString('hex');
  const row = await createShareLink(orgId, user.id, 'site', site.id, expiresAt, perms, token);

  return mapShareLink({ ...row, created_by_email: user.email, created_by_name: user.name });
}

export async function createShareLinkForDevice(
  userId: string,
  deviceId: string,
  expiresAtInput: string | Date,
  permissions = 'read_only'
): Promise<ShareLinkDto> {
  const user = await resolveUser(userId);
  assertCanShare(user);
  const orgId = getOrgId(user);
  const device = await getDeviceById(deviceId, orgId);
  if (!device) {
    throw new ShareLinkError('NOT_FOUND', 'Device not found');
  }

  const perms = permissions ?? 'read_only';
  if (perms !== 'read_only') {
    throw new ShareLinkError('INVALID_PERMISSIONS', 'Only read-only share links are supported');
  }

  const expiresAt = parseExpiresAt(expiresAtInput);
  validateExpiry(expiresAt);
  const token = randomBytes(24).toString('hex');
  const row = await createShareLink(orgId, user.id, 'device', device.id, expiresAt, perms, token);

  return mapShareLink({ ...row, created_by_email: user.email, created_by_name: user.name });
}

export async function listShareLinks(
  userId: string,
  scopeType: 'site' | 'device',
  scopeId: string
): Promise<ShareLinkDto[]> {
  const user = await resolveUser(userId);
  assertCanShare(user);
  const orgId = getOrgId(user);

  if (scopeType === 'site') {
    const site = await getSiteById(scopeId, orgId);
    if (!site) {
      throw new ShareLinkError('NOT_FOUND', 'Site not found');
    }
  } else {
    const device = await getDeviceById(scopeId, orgId);
    if (!device) {
      throw new ShareLinkError('NOT_FOUND', 'Device not found');
    }
  }

  const rows = await listShareLinksForScope(orgId, scopeType, scopeId);
  return rows.map(mapShareLink);
}

export async function revokeShareLinkForUser(userId: string, linkId: string): Promise<ShareLinkDto> {
  const user = await resolveUser(userId);
  assertCanShare(user);
  const orgId = getOrgId(user);

  const revoked = await revokeShareLink(orgId, linkId);
  if (!revoked) {
    throw new ShareLinkError('NOT_FOUND', 'Share link not found');
  }

  return mapShareLink(revoked);
}

export async function resolveShareToken(token: string) {
  const link = await getShareLinkByToken(token);
  if (!link) {
    throw new ShareLinkError('NOT_FOUND', 'Share link is invalid or expired');
  }

  if (link.scope_type === 'site') {
    const payload = await buildSitePayload(link);
    return { share: payload.share, site: payload.site, devices: payload.devices };
  }

  const payload = await buildDevicePayload(link);
  return { share: payload.share, device: payload.device, telemetry: payload.telemetry };
}
