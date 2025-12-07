import { getDeviceById as getDeviceByIdRepo, type DeviceRow } from '../repositories/devicesRepository';
import { getActiveAlertsForOrganisation, type AlertSeverity } from '../repositories/alertsRepository';
import { computeHealthFromSignals, type HealthStatus, summarizeLastSeen } from './healthScoreService';

export type DeviceWithHealth = DeviceRow & {
  health: HealthStatus;
  last_seen: ReturnType<typeof summarizeLastSeen>;
};

export async function getDeviceById(
  id: string,
  organisationId?: string
): Promise<DeviceWithHealth | null> {
  const [device, alerts] = await Promise.all([
    getDeviceByIdRepo(id, organisationId),
    organisationId ? getActiveAlertsForOrganisation(organisationId) : Promise.resolve([]),
  ]);

  if (!device) return null;

  const deviceAlerts: AlertSeverity[] = alerts
    .filter((alert) => alert.device_id === device.id)
    .map((alert) => alert.severity);
  const { health, lastSeen } = computeHealthFromSignals({
    status: device.status,
    lastSeenAt: device.last_seen_at ?? null,
    alerts: deviceAlerts,
  });

  return { ...device, health, last_seen: lastSeen };
}
