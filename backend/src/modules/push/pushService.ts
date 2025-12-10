import { logger } from '../../config/logger';
import {
  isExpoPushToken,
  sendExpoPushMessages,
  type ExpoPushMessage,
} from './expoPushClient';
import {
  deactivatePushToken,
  getActiveTokensForOrg,
  getLatestActiveToken,
  upsertPushToken,
  type PushTokenRow,
} from './pushTokensRepository';
import { getOrganisationIdForAlert, type AlertRow } from '../../repositories/alertsRepository';
import { getUsersByRoles, type UserRole } from '../../repositories/usersRepository';
import { markPushSampleResult } from '../../services/statusService';
import { recordAuditEvent } from '../audit/auditService';

const DEFAULT_ENABLED_ROLES: UserRole[] = ['owner', 'admin', 'facilities'];
const ELIGIBLE_SEVERITIES = new Set(['critical', 'high']);
const log = logger.child({ module: 'push' });

export type PushHealthSample = {
  status: 'ok' | 'error' | 'skipped';
  detail?: string;
  at: string;
};

export type PushHealthStatus = {
  configured: boolean;
  tokensPresent: boolean;
  lastSample: PushHealthSample | null;
};

type DispatchResult = {
  attempted: number;
  sent: number;
  errors: string[];
  skippedReason?: string;
};

function parseEnabledRoles(raw: string | undefined): UserRole[] {
  if (!raw) return DEFAULT_ENABLED_ROLES;
  const parsed = raw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((role): role is UserRole =>
      ['owner', 'admin', 'facilities', 'contractor'].includes(role)
    );
  return parsed.length > 0 ? parsed : DEFAULT_ENABLED_ROLES;
}

function maskToken(token: string) {
  if (!token) return '';
  const tail = token.slice(-6);
  return `***${tail}`;
}

function isPushDisabled() {
  return process.env.PUSH_NOTIFICATIONS_DISABLED === 'true';
}

function isSeverityEligible(severity: string) {
  return ELIGIBLE_SEVERITIES.has(severity);
}

async function dispatchPushMessages(tokens: PushTokenRow[], build: (token: PushTokenRow) => ExpoPushMessage): Promise<DispatchResult> {
  const seen = new Set<string>();
  const messages: ExpoPushMessage[] = [];

  for (const token of tokens) {
    if (!token.is_active) continue;
    if (seen.has(token.expo_push_token)) continue;
    if (!isExpoPushToken(token.expo_push_token)) {
      log.warn({ token: maskToken(token.expo_push_token) }, 'invalid Expo push token');
      continue;
    }
    seen.add(token.expo_push_token);
    messages.push(build(token));
  }

  if (messages.length === 0) {
    return { attempted: 0, sent: 0, errors: [], skippedReason: 'no_valid_tokens' };
  }

  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (!accessToken) {
    log.warn('EXPO_ACCESS_TOKEN not configured; skipping push send');
    return {
      attempted: messages.length,
      sent: 0,
      errors: ['EXPO_ACCESS_TOKEN missing'],
      skippedReason: 'not_configured',
    };
  }

  try {
    const tickets = await sendExpoPushMessages(messages, accessToken);
    return { attempted: messages.length, sent: tickets.length, errors: [] };
  } catch (err) {
    return {
      attempted: messages.length,
      sent: 0,
      errors: [(err as Error | undefined)?.message || 'Push send failed'],
    };
  }
}

async function recordPushAudit(input: {
  orgId: string;
  entityType: 'alert' | 'user';
  entityId: string;
  severity?: string;
  tokenCount: number;
  sent: number;
  userIds?: string[];
  success: boolean;
  reason?: string;
  test?: boolean;
}) {
  try {
    await recordAuditEvent({
      action: 'push_notification_sent',
      orgId: input.orgId,
      userId: null,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: {
        severity: input.severity,
        tokenCount: input.tokenCount,
        sent: input.sent,
        userIds: input.userIds ?? [],
        success: input.success,
        reason: input.reason,
        test: input.test ?? false,
      },
    });
  } catch (err) {
    log.warn({ err }, 'failed to record push audit event');
  }
}

export async function registerPushToken(input: {
  userId: string;
  orgId: string;
  token: string;
  platform: string;
}) {
  if (!isExpoPushToken(input.token)) {
    throw new Error('INVALID_PUSH_TOKEN');
  }

  return upsertPushToken({
    userId: input.userId,
    orgId: input.orgId,
    token: input.token,
    platform: input.platform || 'unknown',
  });
}

export async function unregisterPushToken(input: { userId: string; token: string }) {
  await deactivatePushToken(input);
}

function buildAlertMessage(alert: AlertRow, orgId: string): (token: PushTokenRow) => ExpoPushMessage {
  return (token: PushTokenRow) => ({
    to: token.expo_push_token,
    sound: 'default',
    title: `[${alert.severity.toUpperCase()}] ${alert.type}`,
    body: alert.message,
    data: {
      type: 'alert',
      alertId: alert.id,
      deviceId: alert.device_id,
      siteId: alert.site_id,
      orgId,
      severity: alert.severity,
      alertType: alert.type,
      summary: alert.message,
    },
  });
}

function buildTestMessage(userId: string): (token: PushTokenRow) => ExpoPushMessage {
  return (token: PushTokenRow) => ({
    to: token.expo_push_token,
    sound: 'default',
    title: 'Greenbro test notification',
    body: 'If you see this, push is working for your device.',
    data: {
      type: 'test',
      source: 'diagnostics',
      userId,
    },
  });
}

export async function sendAlertNotification({ alert }: { alert: AlertRow }) {
  const organisationId = await getOrganisationIdForAlert(alert.id);
  if (!organisationId) {
    log.warn({ alertId: alert.id }, 'skipping alert push because organisation is unknown');
    return { skipped: true, reason: 'org_unknown' };
  }

  if (isPushDisabled()) {
    await recordPushAudit({
      orgId: organisationId,
      entityType: 'alert',
      entityId: alert.id,
      severity: alert.severity,
      tokenCount: 0,
      sent: 0,
      userIds: [],
      success: false,
      reason: 'disabled',
    });
    return { skipped: true, reason: 'disabled' };
  }

  if (!isSeverityEligible(alert.severity)) {
    return { skipped: true, reason: 'severity_not_eligible' };
  }

  const mutedUntil = alert.muted_until ? new Date(alert.muted_until) : null;
  if (mutedUntil && mutedUntil > new Date()) {
    log.info(
      { alertId: alert.id, mutedUntil: mutedUntil.toISOString() },
      'skipping notification for muted alert'
    );
    await recordPushAudit({
      orgId: organisationId,
      entityType: 'alert',
      entityId: alert.id,
      severity: alert.severity,
      tokenCount: 0,
      sent: 0,
      userIds: [],
      success: false,
      reason: 'muted',
    });
    return { skipped: true, reason: 'muted' };
  }

  const roles = parseEnabledRoles(process.env.PUSH_NOTIFICATIONS_ENABLED_ROLES);
  const users = await getUsersByRoles(organisationId, roles);
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    await recordPushAudit({
      orgId: organisationId,
      entityType: 'alert',
      entityId: alert.id,
      severity: alert.severity,
      tokenCount: 0,
      sent: 0,
      userIds: [],
      success: false,
      reason: 'no_recipients',
    });
    return { skipped: true, reason: 'no_recipients' };
  }

  const tokens = await getActiveTokensForOrg(organisationId, userIds);
  const dispatch = await dispatchPushMessages(tokens, buildAlertMessage(alert, organisationId));

  await recordPushAudit({
    orgId: organisationId,
    entityType: 'alert',
    entityId: alert.id,
    severity: alert.severity,
    tokenCount: dispatch.attempted,
    sent: dispatch.sent,
    userIds,
    success: dispatch.errors.length === 0 && !dispatch.skippedReason,
    reason: dispatch.skippedReason || dispatch.errors[0],
  });

  if (dispatch.errors.length > 0) {
    log.error(
      { alertId: alert.id, errors: dispatch.errors },
      'error sending push notifications for alert'
    );
  } else if (dispatch.sent > 0) {
    log.info({ alertId: alert.id, sent: dispatch.sent }, 'push tickets sent for alert');
  }

  return dispatch;
}

export async function sendTestNotification(options: {
  orgId: string;
  userId: string;
  tokens: PushTokenRow[];
}) {
  if (isPushDisabled()) {
    await recordPushAudit({
      orgId: options.orgId,
      entityType: 'user',
      entityId: options.userId,
      tokenCount: 0,
      sent: 0,
      userIds: [options.userId],
      success: false,
      reason: 'disabled',
      test: true,
    });
    return { skipped: true, reason: 'disabled' } as const;
  }

  const dispatch = await dispatchPushMessages(options.tokens, buildTestMessage(options.userId));

  await recordPushAudit({
    orgId: options.orgId,
    entityType: 'user',
    entityId: options.userId,
    tokenCount: dispatch.attempted,
    sent: dispatch.sent,
    userIds: [options.userId],
    success: dispatch.errors.length === 0 && !dispatch.skippedReason,
    reason: dispatch.skippedReason || dispatch.errors[0],
    test: true,
  });

  return dispatch;
}

let lastPushSample: PushHealthSample | null = null;

export async function runPushHealthCheck(): Promise<PushHealthStatus> {
  const configured = !isPushDisabled() && Boolean(process.env.EXPO_ACCESS_TOKEN);
  const token = process.env.PUSH_HEALTHCHECK_TOKEN || (await getLatestActiveToken());
  const tokensPresent = Boolean(token);
  const now = new Date();
  const healthcheckEnabled = process.env.PUSH_HEALTHCHECK_ENABLED === 'true';
  const intervalMinutes = Number(process.env.PUSH_HEALTHCHECK_INTERVAL_MINUTES || 30);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  const buildResponse = () => ({
    configured,
    tokensPresent,
    lastSample: lastPushSample,
  });

  if (!configured) {
    lastPushSample = {
      status: 'skipped',
      detail: 'EXPO_ACCESS_TOKEN missing',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (!token) {
    lastPushSample = {
      status: 'skipped',
      detail: 'No push tokens registered',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (!healthcheckEnabled) {
    lastPushSample = {
      status: 'skipped',
      detail: 'PUSH_HEALTHCHECK_ENABLED is false',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (lastPushSample) {
    const lastAt = new Date(lastPushSample.at).getTime();
    if (now.getTime() - lastAt < intervalMs) {
      return buildResponse();
    }
  }

  try {
    const message: ExpoPushMessage = {
      to: token,
      sound: 'default',
      title: 'Greenbro health check',
      body: 'Push delivery path verified',
      data: { type: 'healthcheck' },
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('EXPO_ACCESS_TOKEN missing');
    }
    await sendExpoPushMessages([message], accessToken);
    lastPushSample = {
      status: 'ok',
      detail: `Sent to token ${maskToken(token)}`,
      at: now.toISOString(),
    };
    await markPushSampleResult(now, null);
  } catch (e) {
    lastPushSample = {
      status: 'error',
      detail: (e as Error | undefined)?.message || 'Push health send failed',
      at: now.toISOString(),
    };
    await markPushSampleResult(now, e);
  }

  return buildResponse();
}

export function isPushFeatureDisabled() {
  return isPushDisabled();
}
