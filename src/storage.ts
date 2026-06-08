// Lazy require so the app doesn't crash if the native module is unavailable.
// Falls back to in-memory storage (works but doesn't persist between restarts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AS: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AS = require("@react-native-async-storage/async-storage").default;
} catch {}

const mem: Record<string, string> = {};

async function get(key: string): Promise<string | null> {
  try { if (AS) return await AS.getItem(key) as string | null; } catch {}
  return mem[key] ?? null;
}

async function set(key: string, value: string): Promise<void> {
  mem[key] = value;
  try { if (AS) await AS.setItem(key, value); } catch {}
}

async function remove(key: string): Promise<void> {
  delete mem[key];
  try { if (AS) await AS.removeItem(key); } catch {}
}

export async function loadStoredArray<T>(key: string): Promise<T[]> {
  try { return JSON.parse((await get(key)) ?? "[]") as T[]; }
  catch { return []; }
}

export async function loadStoredObject<T extends Record<string, unknown>>(
  key: string, fallback: T,
): Promise<T> {
  try { return { ...fallback, ...(JSON.parse((await get(key)) ?? "{}") as Partial<T>) }; }
  catch { return fallback; }
}

export async function saveStoredValue<T>(key: string, value: T): Promise<void> {
  await set(key, JSON.stringify(value));
}

export async function removeStoredValue(key: string): Promise<void> {
  await remove(key);
}
