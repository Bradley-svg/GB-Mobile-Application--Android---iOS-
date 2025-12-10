export type DeviceCodeResult =
  | { kind: 'deviceId'; deviceId: string }
  | { kind: 'mac'; mac: string };

export type DeviceCodeParseReason = 'INVALID_FORMAT' | 'UNSUPPORTED_PREFIX';

export class DeviceCodeParseError extends Error {
  reason: DeviceCodeParseReason;

  constructor(message: string, reason: DeviceCodeParseReason) {
    super(message);
    this.reason = reason;
    this.name = 'DeviceCodeParseError';
  }
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const macHexRegex = /^[0-9a-f]{12}$/i;

function normalizeMac(mac: string): string {
  const hex = mac.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (!macHexRegex.test(hex)) {
    throw new DeviceCodeParseError('Invalid MAC address', 'INVALID_FORMAT');
  }
  const pairs = hex.match(/.{1,2}/g) || [];
  return pairs.join(':');
}

export function parseDeviceCode(input: string): DeviceCodeResult {
  const code = input.trim();
  if (!code) {
    throw new DeviceCodeParseError('Empty code', 'INVALID_FORMAT');
  }

  if (code.startsWith('device:')) {
    const deviceId = code.slice('device:'.length);
    if (!uuidRegex.test(deviceId)) {
      throw new DeviceCodeParseError('Invalid device id in code', 'INVALID_FORMAT');
    }
    return { kind: 'deviceId', deviceId };
  }

  if (code.startsWith('mac:')) {
    const rawMac = code.slice('mac:'.length);
    const mac = normalizeMac(rawMac);
    return { kind: 'mac', mac };
  }

  throw new DeviceCodeParseError('Unsupported code prefix', 'UNSUPPORTED_PREFIX');
}
