import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedEntry<T> = {
  data: T;
  savedAt: string | null;
};

export async function saveJson(key: string, value: unknown) {
  try {
    const wrapped = {
      data: value,
      savedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(wrapped);
    await AsyncStorage.setItem(key, serialized);
  } catch (err) {
    console.error('Failed to persist cached data', err);
  }
}

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return (parsed as CachedEntry<T>).data;
    }
    return parsed as T;
  } catch (err) {
    console.warn('Failed to read cached data', err);
    return null;
  }
}

export async function loadJsonWithMetadata<T>(key: string): Promise<CachedEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed as CachedEntry<T>;
    }
    return { data: parsed as T, savedAt: null };
  } catch (err) {
    console.warn('Failed to read cached data', err);
    return null;
  }
}

export function isCacheOlderThan(
  savedAt: string | null,
  thresholdMs: number,
  now: Date = new Date()
) {
  if (!savedAt) return false;
  const parsed = new Date(savedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return now.getTime() - parsed.getTime() > thresholdMs;
}
