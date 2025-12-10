import type { AlertRow } from '../repositories/alertsRepository';
import { getUserContext, requireOrganisationId } from './userService';
import {
  isPushFeatureDisabled,
  registerPushToken,
  runPushHealthCheck as coreRunPushHealthCheck,
  sendAlertNotification as coreSendAlertNotification,
  type PushHealthStatus,
} from '../modules/push/pushService';

export { isPushFeatureDisabled };
export type { PushHealthStatus };

export async function sendAlertNotification(alert: AlertRow) {
  return coreSendAlertNotification({ alert });
}

export async function runPushHealthCheck(): Promise<PushHealthStatus> {
  return coreRunPushHealthCheck();
}

export async function registerPushTokenForUser(userId: string, token: string) {
  const user = await getUserContext(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  const orgId = requireOrganisationId(user);
  return registerPushToken({ userId, orgId, token, platform: 'unknown' });
}
