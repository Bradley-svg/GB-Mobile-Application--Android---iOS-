import type { UserRole } from '../../repositories/usersRepository';
import {
  findDeviceByMac,
  findDeviceSummaryById,
  type DeviceSummaryRow,
} from '../../repositories/devicesRepository';
import { canLookupDeviceByCode } from '../../services/rbacService';
import { recordAuditEvent } from '../audit/auditService';
import { DeviceCodeParseError, parseDeviceCode } from './deviceCodeParser';

export type DeviceQrLookupReason = 'INVALID_CODE' | 'FORBIDDEN' | 'NOT_FOUND';

export class DeviceQrLookupError extends Error {
  reason: DeviceQrLookupReason;

  constructor(message: string, reason: DeviceQrLookupReason) {
    super(message);
    this.reason = reason;
    this.name = 'DeviceQrLookupError';
  }
}

type LookupInput = {
  code: string;
  orgId: string;
  userId: string;
  userRole: UserRole;
};

export async function lookupDeviceByCode(input: LookupInput): Promise<DeviceSummaryRow> {
  const { code, orgId, userId, userRole } = input;

  if (!canLookupDeviceByCode({ role: userRole })) {
    await recordAuditEvent({
      action: 'device_qr_lookup',
      orgId,
      userId,
      entityType: 'device_lookup',
      entityId: 'forbidden',
      metadata: { result: 'forbidden', role: userRole },
    });
    throw new DeviceQrLookupError('Role not permitted to scan devices', 'FORBIDDEN');
  }

  let parsed;
  try {
    parsed = parseDeviceCode(code);
  } catch (err) {
    if (err instanceof DeviceCodeParseError) {
      await recordAuditEvent({
        action: 'device_qr_lookup',
        orgId,
        userId,
        entityType: 'device_lookup',
        entityId: 'invalid_code',
        metadata: { result: 'invalid_code', reason: err.reason },
      });
      throw new DeviceQrLookupError('Invalid device code', 'INVALID_CODE');
    }
    throw err;
  }

  const device =
    parsed.kind === 'deviceId'
      ? await findDeviceSummaryById(parsed.deviceId, orgId)
      : await findDeviceByMac(parsed.mac, orgId);

  await recordAuditEvent({
    action: 'device_qr_lookup',
    orgId,
    userId,
    entityType: 'device_lookup',
    entityId: device?.id ?? (parsed.kind === 'deviceId' ? parsed.deviceId : parsed.mac),
    metadata: {
      result: device ? 'found' : 'not_found',
      codeKind: parsed.kind,
    },
  });

  if (!device) {
    throw new DeviceQrLookupError('Device not found for this code', 'NOT_FOUND');
  }

  return device;
}
