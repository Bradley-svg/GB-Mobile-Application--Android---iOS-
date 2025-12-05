import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveJson(key: string, value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    await AsyncStorage.setItem(key, serialized);
  } catch (err) {
    console.error('Failed to persist cached data', err);
  }
}

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('Failed to read cached data', err);
    return null;
  }
}
