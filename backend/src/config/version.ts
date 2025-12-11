export const CURRENT_VERSION = '0.7.0';

export function getAppVersion(): string {
  return process.env.APP_VERSION || process.env.npm_package_version || CURRENT_VERSION;
}
