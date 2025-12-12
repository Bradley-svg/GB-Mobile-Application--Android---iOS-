import { logger } from './logger';

const PROD_LIKE_ENVS = ['production', 'staging'];
const VENDOR_DISABLE_FLAGS = [
  'HEATPUMP_HISTORY_DISABLED',
  'CONTROL_API_DISABLED',
  'MQTT_DISABLED',
  'PUSH_NOTIFICATIONS_DISABLED',
];

export function getVendorFlagSummary(nodeEnv = process.env.NODE_ENV || 'development') {
  const prodLike = PROD_LIKE_ENVS.includes(nodeEnv);
  const disabled = VENDOR_DISABLE_FLAGS.filter((flag) => process.env[flag] === 'true');
  return {
    prodLike,
    disabled,
    mqttDisabled: disabled.includes('MQTT_DISABLED'),
    controlDisabled: disabled.includes('CONTROL_API_DISABLED'),
    heatPumpHistoryDisabled: disabled.includes('HEATPUMP_HISTORY_DISABLED'),
    pushNotificationsDisabled: disabled.includes('PUSH_NOTIFICATIONS_DISABLED'),
  };
}

export function checkVendorDisableFlags(nodeEnv = process.env.NODE_ENV || 'development') {
  const summary = getVendorFlagSummary(nodeEnv);

  if (summary.prodLike && summary.disabled.length > 0) {
    logger.warn(
      { disabledFlags: summary.disabled, env: nodeEnv },
      'vendor disable flags are set in a prod-like environment. These flags are intended for CI/E2E only.'
    );
    // TODO: escalate to a hard failure once rollout is stable.
  }

  return { prodLike: summary.prodLike, disabledFlags: summary.disabled };
}
