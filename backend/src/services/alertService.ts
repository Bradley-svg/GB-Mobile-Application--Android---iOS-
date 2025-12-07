import {
  type AlertRow,
  type AlertSeverity,
  type AlertType,
  acknowledgeAlert as acknowledgeAlertRepo,
  clearAlertIfExists as clearAlertIfExistsRepo,
  fetchAlerts,
  fetchAlertsForDevice,
  findActiveAlert,
  findAlertForOrganisation,
  insertAlert,
  muteAlert as muteAlertRepo,
  updateAlert,
} from '../repositories/alertsRepository';

export type { AlertRow, AlertSeverity, AlertType } from '../repositories/alertsRepository';

export async function upsertActiveAlert(options: {
  siteId: string | null;
  deviceId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  now: Date;
}): Promise<{ alert: AlertRow; isNew: boolean }> {
  const { siteId, deviceId, type, severity, message, now } = options;

  const existing = await findActiveAlert(deviceId, type);

  if (existing) {
    const alert = await updateAlert(existing.id, severity, message, now);
    return { alert, isNew: false };
  }

  const alert = await insertAlert({ siteId, deviceId, severity, type, message, now });

  return { alert, isNew: true };
}

export async function clearAlertIfExists(deviceId: string, type: AlertType, now: Date) {
  await clearAlertIfExistsRepo(deviceId, type, now);
}

export async function getAlerts(filters: {
  siteId?: string;
  severity?: string;
  status?: string;
  limit?: number;
  organisationId: string;
}) {
  return fetchAlerts(filters);
}

export async function getAlertsForDevice(deviceId: string, organisationId: string) {
  return fetchAlertsForDevice(deviceId, organisationId);
}

export async function acknowledgeAlert(
  alertId: string,
  userId: string,
  organisationId: string
): Promise<AlertRow | null> {
  const alert = await findAlertForOrganisation(alertId, organisationId);
  if (!alert) return null;

  return acknowledgeAlertRepo(alertId, userId);
}

export async function muteAlert(
  alertId: string,
  minutes: number,
  organisationId: string
): Promise<AlertRow | null> {
  const alert = await findAlertForOrganisation(alertId, organisationId);
  if (!alert) return null;

  return muteAlertRepo(alertId, minutes);
}
