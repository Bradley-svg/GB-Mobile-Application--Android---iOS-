import type { AlertSeverity } from './alertService';

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';

export type LastSeenSummary = {
  at: string | null;
  ageMinutes: number | null;
  isStale: boolean;
  isOffline: boolean;
};

const DEFAULT_WARNING_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const DEFAULT_OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_CRITICAL_MINUTES || 60);

const HEALTH_ORDER: Record<HealthStatus, number> = {
  healthy: 0,
  warning: 1,
  critical: 2,
  offline: 3,
};

const ALERT_ORDER: Record<AlertSeverity, number> = {
  critical: 2,
  warning: 1,
  info: 0,
};

function normalizeDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function summarizeLastSeen(
  lastSeenAt?: string | Date | null,
  now: Date = new Date(),
  warningMinutes: number = DEFAULT_WARNING_MINUTES,
  offlineMinutes: number = DEFAULT_OFFLINE_MINUTES
): LastSeenSummary {
  const normalized = normalizeDate(lastSeenAt);
  if (!normalized) {
    return {
      at: null,
      ageMinutes: null,
      isStale: true,
      isOffline: true,
    };
  }

  const ageMinutes = (now.getTime() - normalized.getTime()) / (60 * 1000);
  const isOffline = ageMinutes >= offlineMinutes;
  const isStale = ageMinutes >= warningMinutes;

  return {
    at: normalized.toISOString(),
    ageMinutes: Number.isFinite(ageMinutes) ? Number(ageMinutes.toFixed(1)) : null,
    isStale,
    isOffline,
  };
}

function normalizeStatus(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  return {
    isOffline: normalized.includes('offline') || normalized.includes('down'),
    isCritical: normalized.includes('critical'),
    isWarning: normalized.includes('warn'),
  };
}

function pickWorstSeverity(severities: AlertSeverity[]): AlertSeverity | null {
  if (!severities || severities.length === 0) return null;
  return severities.reduce<AlertSeverity | null>((worst, severity) => {
    if (!worst) return severity;
    return ALERT_ORDER[severity] > ALERT_ORDER[worst] ? severity : worst;
  }, null);
}

export function computeHealthFromSignals(options: {
  status?: string | null;
  lastSeenAt?: string | Date | null;
  alerts?: AlertSeverity[];
  now?: Date;
  warningMinutes?: number;
  offlineMinutes?: number;
}): { health: HealthStatus; lastSeen: LastSeenSummary; dominantSeverity: AlertSeverity | null } {
  const { status, lastSeenAt, alerts = [], now = new Date(), warningMinutes, offlineMinutes } = options;
  const lastSeen = summarizeLastSeen(lastSeenAt, now, warningMinutes, offlineMinutes);
  const { isOffline: statusOffline, isCritical: statusCritical, isWarning: statusWarning } =
    normalizeStatus(status);
  const dominantSeverity = pickWorstSeverity(alerts);

  if (statusOffline || lastSeen.isOffline) {
    return { health: 'offline', lastSeen, dominantSeverity };
  }
  if (statusCritical || dominantSeverity === 'critical') {
    return { health: 'critical', lastSeen, dominantSeverity };
  }
  if (statusWarning || dominantSeverity === 'warning' || lastSeen.isStale) {
    return { health: 'warning', lastSeen, dominantSeverity };
  }

  return { health: 'healthy', lastSeen, dominantSeverity };
}

export function combineHealth(healthStates: HealthStatus[]): HealthStatus {
  if (!healthStates || healthStates.length === 0) return 'healthy';
  return healthStates.reduce<HealthStatus>((worst, current) => {
    return HEALTH_ORDER[current] > HEALTH_ORDER[worst] ? current : worst;
  }, 'healthy');
}

