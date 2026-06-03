import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const defaultServerConfig = {
  cacheTtlMs: 24 * 60 * 60 * 1000,
  googlePlacesRadiusMeters: 5000,
  maxPlacesResults: 12,
  rateLimitMaxRequests: 30,
  rateLimitWindowMs: 60 * 1000,
};

export function loadEnvFile(root) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    const name = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (name && !process.env[name]) process.env[name] = value;
  }
}

export function loadServerConfig() {
  return {
    cacheTtlMs: numberFromEnv("PLACES_CACHE_TTL_MS", defaultServerConfig.cacheTtlMs),
    googlePlacesRadiusMeters: numberFromEnv("GOOGLE_PLACES_RADIUS_METERS", defaultServerConfig.googlePlacesRadiusMeters),
    maxPlacesResults: numberFromEnv("GOOGLE_PLACES_MAX_RESULTS", defaultServerConfig.maxPlacesResults),
    rateLimitMaxRequests: numberFromEnv("RATE_LIMIT_MAX_REQUESTS", defaultServerConfig.rateLimitMaxRequests),
    rateLimitWindowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", defaultServerConfig.rateLimitWindowMs),
  };
}

export function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getClientIp(request) {
  return request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "local";
}

export function isRateLimited(requestLog, key, now, config) {
  const hits = (requestLog.get(key) || []).filter((timestamp) => now - timestamp < config.rateLimitWindowMs);
  hits.push(now);
  requestLog.set(key, hits);
  return hits.length > config.rateLimitMaxRequests;
}

// ── Optimización 4: normalización de query con diacríticos ──────────────────
// "Café" y "cafe" producen la misma clave de caché.
export function normalizeQueryForCache(query) {
  return query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── Optimización 5: snap de coordenadas al centro de la celda ────────────────
// Todos los usuarios en la misma celda de ~5,5 km envían exactamente las mismas
// coordenadas a Google → la primera petición llena la caché, todas las siguientes
// son HIT sin importar la posición exacta del usuario dentro de la celda.
export function snapToGridCenter(value) {
  return (Math.floor(value * 20) + 0.5) / 20;
}

export function getPlacesCacheKey(query, latitude, longitude) {
  return JSON.stringify({
    query: normalizeQueryForCache(query),
    latCell: snapToGridCenter(latitude),
    lonCell: snapToGridCenter(longitude),
  });
}

// ── Optimización 1–2: WAL + índice para mejor rendimiento de lectura ─────────
export function createPlacesCacheDatabase(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);

  // Opt-1: WAL permite lecturas concurrentes sin bloquear escrituras
  database.exec("PRAGMA journal_mode = WAL");
  // Extra PRAGMAs de rendimiento seguros con WAL
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA cache_size = -32000"); // 32 MB de caché en memoria
  database.exec("PRAGMA temp_store = MEMORY");

  database.exec(`
    CREATE TABLE IF NOT EXISTS places_cache (
      cache_key TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      places_json TEXT NOT NULL
    )
  `);

  // Opt-2: índice en created_at para acelerar consultas de TTL y cleanup
  database.exec("CREATE INDEX IF NOT EXISTS idx_places_cache_created_at ON places_cache(created_at)");

  return database;
}

// ── Optimización 6: stale-while-revalidate ───────────────────────────────────
// Devuelve { places, stale } dentro del doble del TTL; null si es demasiado viejo.
// El servidor puede servir el resultado stale inmediatamente y refrescar en background.
export function getCachedPlaces(database, cacheKey, ttlMs, now = Date.now()) {
  const row = database
    .prepare("SELECT created_at, places_json FROM places_cache WHERE cache_key = ?")
    .get(cacheKey);

  if (!row) return null;

  const age = now - Number(row.created_at);
  if (age >= ttlMs * 2) return null; // más viejo que la ventana de gracia → expirado de verdad

  try {
    return { places: JSON.parse(String(row.places_json)), stale: age >= ttlMs };
  } catch {
    return null;
  }
}

export function setCachedPlaces(database, cacheKey, places, now = Date.now()) {
  database
    .prepare(
      `INSERT INTO places_cache (cache_key, created_at, places_json)
       VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         created_at = excluded.created_at,
         places_json = excluded.places_json`,
    )
    .run(cacheKey, now, JSON.stringify(places));
}

// ── Optimización 3: limpieza periódica de entradas expiradas ─────────────────
// Mantiene SQLite compacto eliminando entradas más viejas que la ventana de gracia.
export function cleanExpiredCache(database, ttlMs, now = Date.now()) {
  const cutoff = now - ttlMs * 2;
  database.prepare("DELETE FROM places_cache WHERE created_at < ?").run(cutoff);
}

// ── Optimización 7: estadísticas de caché ────────────────────────────────────
export function getCacheStats(database, ttlMs, now = Date.now()) {
  // Coherente con getCachedPlaces: fresh → age < ttlMs, stale → ttlMs ≤ age < ttlMs*2, expired → age ≥ ttlMs*2
  // En términos de created_at: fresh > now-ttlMs, stale ∈ (now-ttlMs*2, now-ttlMs], expired ≤ now-ttlMs*2
  const total = database.prepare("SELECT COUNT(*) as n FROM places_cache").get().n;
  const fresh = database.prepare("SELECT COUNT(*) as n FROM places_cache WHERE created_at > ?").get(now - ttlMs).n;
  const stale = database.prepare("SELECT COUNT(*) as n FROM places_cache WHERE created_at > ? AND created_at <= ?").get(now - ttlMs * 2, now - ttlMs).n;
  return { total, fresh, stale, expired: total - fresh - stale };
}

export function createStructuredLogger() {
  return {
    info(event, data = {}) {
      console.log(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...data }));
    },
    warn(event, data = {}) {
      console.warn(JSON.stringify({ level: "warn", event, at: new Date().toISOString(), ...data }));
    },
    error(event, data = {}) {
      console.error(JSON.stringify({ level: "error", event, at: new Date().toISOString(), ...data }));
    },
  };
}

export function validatePlacesPayload(payload) {
  if (!payload || !Array.isArray(payload.places)) return [];

  return payload.places.filter((place) => {
    return (
      place &&
      typeof place === "object" &&
      (typeof place.id === "string" || typeof place.name === "string") &&
      place.displayName &&
      typeof place.displayName.text === "string" &&
      place.location &&
      Number.isFinite(Number(place.location.latitude)) &&
      Number.isFinite(Number(place.location.longitude))
    );
  });
}

export function providerError(statusCode, message, code = "PROVIDER_ERROR") {
  return { statusCode, body: { code, message } };
}
