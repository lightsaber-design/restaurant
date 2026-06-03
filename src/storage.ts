import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadStoredArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return JSON.parse(raw || "[]") as T[];
  } catch {
    return [];
  }
}

export async function loadStoredObject<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return { ...fallback, ...(JSON.parse(raw || "{}") as Partial<T>) };
  } catch {
    return fallback;
  }
}

export async function saveStoredValue<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or unavailable — silently skip
  }
}

export async function removeStoredValue(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // silently skip
  }
}
