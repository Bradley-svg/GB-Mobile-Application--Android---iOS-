export const PUSH_TOKEN_STORAGE_PREFIX = 'pushTokenRegisteredForUser:';
export const LEGACY_PUSH_TOKEN_KEY = 'greenbro_push_token_registered';

export function getPushTokenStorageKey(userId: string) {
  return `${PUSH_TOKEN_STORAGE_PREFIX}${userId}`;
}
