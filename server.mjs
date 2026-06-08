import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  cleanExpiredCache,
  createPlacesCacheDatabase,
  createStructuredLogger,
  getCacheStats,
  getCachedPlaces,
  getClientIp,
  getPlacesCacheKey,
  isRateLimited,
  loadEnvFile,
  loadServerConfig,
  providerError,
  setCachedPlaces,
  snapToGridCenter,
  validatePlacesPayload,
} from "./server-utils.mjs";

const port = Number.parseInt(process.env.PORT || "4173", 10);
const root = process.cwd();
const staticRoot = existsSync(join(root, "dist")) ? join(root, "dist") : root;
loadEnvFile(root);

const config = loadServerConfig();
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const logger = createStructuredLogger();
const requestLog = new Map();
const placesCacheDatabase = createPlacesCacheDatabase(join(root, ".cache", "places-cache.sqlite"));

// ── Optimización 10: coalescing de peticiones en vuelo ───────────────────────
// Si dos peticiones llegan simultáneamente con la misma clave, solo se hace
// una llamada a Google; la segunda espera el resultado de la primera.
const inFlightRequests = new Map();

// ── Optimización 7b: contadores de estadísticas en memoria ───────────────────
let statHits = 0, statMisses = 0, statStale = 0, statCoalesced = 0;

// ── Opt-18: caché en memoria para fotos ─────────────────────────────────────
const PHOTO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const photoCache = new Map();

// Rate-limit log cleanup
setInterval(() => {
  const cutoff = Date.now() - config.rateLimitWindowMs;
  for (const [key, hits] of requestLog) {
    if (hits.every((t) => t < cutoff)) requestLog.delete(key);
  }
}, config.rateLimitWindowMs).unref();

// ── Optimización 3: limpieza periódica de SQLite ─────────────────────────────
setInterval(() => {
  cleanExpiredCache(placesCacheDatabase, config.cacheTtlMs);
}, 60 * 60 * 1000).unref();

// Photo memory-cache cleanup
setInterval(() => {
  const cutoff = Date.now() - PHOTO_CACHE_TTL_MS;
  for (const [key, entry] of photoCache) {
    if (entry.cachedAt < cutoff) photoCache.delete(key);
  }
}, PHOTO_CACHE_TTL_MS).unref();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// ── Optimización 11: Connection: keep-alive en cabeceras base ────────────────
const BASE_HEADERS = { "Connection": "keep-alive", "Keep-Alive": "timeout=30" };

// ── Optimización 8: compresión gzip cuando el cliente la acepta ──────────────
function sendJson(response, statusCode, body, headers = {}, acceptEncoding = "") {
  const json = JSON.stringify(body);
  const allHeaders = { "Content-Type": "application/json; charset=utf-8", ...BASE_HEADERS, ...headers };

  if (acceptEncoding.includes("gzip") && json.length > 512) {
    const compressed = gzipSync(Buffer.from(json));
    response.writeHead(statusCode, {
      ...allHeaders,
      "Content-Encoding": "gzip",
      "Vary": "Accept-Encoding",
      "Content-Length": compressed.length,
    });
    response.end(compressed);
  } else {
    response.writeHead(statusCode, allHeaders);
    response.end(json);
  }
}

// ── Optimización 9: ETag para respuestas no modificadas ─────────────────────
function computeETag(data) {
  return `"${createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 20)}"`;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.priceRange",
  "places.regularOpeningHours",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.photos",
].join(",");

// ── Extracción del fetch a Google para coalescing + SWR ──────────────────────
async function doGoogleFetch(query, latSnapped, lonSnapped, radiusMeters, maxResultCount) {
  const useNearbySearch = !query;

  // ── Optimización 13: locationRestriction (límite duro) cuando el radio es explícito
  // Para búsqueda cercana siempre usamos locationRestriction.
  // Para búsqueda de texto, locationRestriction garantiza resultados dentro del radio.
  const endpoint = useNearbySearch
    ? "https://places.googleapis.com/v1/places:searchNearby"
    : "https://places.googleapis.com/v1/places:searchText";

  const requestBody = useNearbySearch
    ? {
        includedTypes: ["restaurant"],
        maxResultCount,
        locationRestriction: {
          circle: { center: { latitude: latSnapped, longitude: lonSnapped }, radius: radiusMeters },
        },
        languageCode: "es",
        rankPreference: "DISTANCE",
      }
    : {
        textQuery: `${query} restaurante`,
        maxResultCount,
        // searchText solo acepta "circle" bajo locationBias (locationRestriction
        // exige un rectángulo). Usamos locationBias.circle para acotar por radio.
        locationBias: {
          circle: { center: { latitude: latSnapped, longitude: lonSnapped }, radius: radiusMeters },
        },
        includedType: "restaurant",
        languageCode: "es",
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleMapsApiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error?.message || "La solicitud a Google Places falló.";
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return validatePlacesPayload(payload);
}

// ── Optimización 10: coalescing — una sola petición por clave en vuelo ───────
async function fetchAndCachePlaces(cacheKey, query, latSnapped, lonSnapped, radiusMeters, maxResultCount) {
  if (inFlightRequests.has(cacheKey)) {
    statCoalesced++;
    return inFlightRequests.get(cacheKey);
  }

  const promise = doGoogleFetch(query, latSnapped, lonSnapped, radiusMeters, maxResultCount)
    .then((places) => {
      setCachedPlaces(placesCacheDatabase, cacheKey, places);
      return places;
    })
    .finally(() => inFlightRequests.delete(cacheKey));

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

async function handlePlacesSearch(request, response) {
  const acceptEncoding = request.headers["accept-encoding"] || "";
  const clientIp = getClientIp(request);

  if (isRateLimited(requestLog, clientIp, Date.now(), config)) {
    logger.warn("rate_limited", { clientIp });
    sendJson(response, 429, providerError(429, "Demasiadas búsquedas. Espera un minuto e inténtalo de nuevo.", "RATE_LIMITED").body);
    return;
  }

  if (!googleMapsApiKey) {
    sendJson(response, 501, providerError(501, "Configura GOOGLE_MAPS_API_KEY y ejecuta node server.mjs para cargar restaurantes reales de Google Places.", "GOOGLE_KEY_MISSING").body);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const query = (url.searchParams.get("query") || "").trim();
  const latitude = Number(url.searchParams.get("latitude"));
  const longitude = Number(url.searchParams.get("longitude"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    sendJson(response, 400, providerError(400, "Coordenadas de ubicación no válidas.", "BAD_LOCATION").body);
    return;
  }

  // ── Optimización 5: snap al centro de celda ──────────────────────────────
  // Todos los usuarios de la misma celda envían las mismas coordenadas a Google.
  const latSnapped = snapToGridCenter(latitude);
  const lonSnapped = snapToGridCenter(longitude);

  // ── Optimización 12: maxResultCount y radio dinámicos según preferencia ───
  const radiusParam = url.searchParams.get("radius"); // "1" | "3" | "5" | ""
  const radiusMeters = radiusParam && radiusParam !== "all"
    ? Number(radiusParam) * 1000
    : config.googlePlacesRadiusMeters;
  const maxResultCount = radiusParam === "1" ? 5 : radiusParam === "3" ? 8 : config.maxPlacesResults;

  const cacheKey = getPlacesCacheKey(query, latitude, longitude);

  // ── Optimización 6: stale-while-revalidate ───────────────────────────────
  const cacheResult = getCachedPlaces(placesCacheDatabase, cacheKey, config.cacheTtlMs);
  if (cacheResult) {
    const { places, stale } = cacheResult;

    // ── Optimización 9: ETag + 304 ──────────────────────────────────────────
    const etag = computeETag(places);
    if (!stale && request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ...BASE_HEADERS, "ETag": etag, "Cache-Control": "public, max-age=60" });
      response.end();
      return;
    }

    if (stale) statStale++; else statHits++;
    logger.info("places_cache_hit", { query, latSnapped, lonSnapped, count: places.length, stale });

    sendJson(
      response, 200,
      { places, cached: true, stale },
      { "X-Cache": stale ? "STALE" : "HIT", "ETag": etag },
      acceptEncoding,
    );

    // Refresco en background sin bloquear la respuesta
    if (stale && !inFlightRequests.has(cacheKey)) {
      fetchAndCachePlaces(cacheKey, query, latSnapped, lonSnapped, radiusMeters, maxResultCount)
        .catch((err) => logger.warn("background_refresh_failed", { message: err.message }));
    }
    return;
  }

  statMisses++;
  const startedAt = Date.now();

  try {
    const places = await fetchAndCachePlaces(cacheKey, query, latSnapped, lonSnapped, radiusMeters, maxResultCount);
    const etag = computeETag(places);

    logger.info("places_search", {
      query, latSnapped, lonSnapped,
      count: places.length,
      latencyMs: Date.now() - startedAt,
      coalesced: statCoalesced,
    });

    sendJson(response, 200, { places, cached: false }, { "X-Cache": "MISS", "ETag": etag }, acceptEncoding);
  } catch (error) {
    const status = error.status || 502;
    logger.error("places_provider_error", { status, message: error.message });
    sendJson(response, status, providerError(status, error.message || "La solicitud a Google Places falló.", "GOOGLE_PLACES_ERROR").body);
  }
}

// ── Optimización 15: endpoint de estadísticas ────────────────────────────────
function handleStats(response) {
  const dbStats = getCacheStats(placesCacheDatabase, config.cacheTtlMs);
  sendJson(response, 200, {
    requests: { hits: statHits, misses: statMisses, stale: statStale, coalesced: statCoalesced },
    cache: dbStats,
  });
}

async function handlePhotoProxy(request, response) {
  if (!googleMapsApiKey) {
    response.writeHead(404, BASE_HEADERS);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const photoName = url.searchParams.get("name") || "";

  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName)) {
    response.writeHead(400, { "Content-Type": "text/plain", ...BASE_HEADERS });
    response.end("Invalid photo reference");
    return;
  }

  const cached = photoCache.get(photoName);
  if (cached && Date.now() - cached.cachedAt < PHOTO_CACHE_TTL_MS) {
    response.writeHead(200, {
      "Content-Type": cached.contentType,
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(cached.buffer.length),
      "X-Cache": "HIT",
      ...BASE_HEADERS,
    });
    response.end(cached.buffer);
    return;
  }

  try {
    const photoResponse = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true&key=${googleMapsApiKey}`,
    );
    if (!photoResponse.ok) {
      response.writeHead(photoResponse.status, BASE_HEADERS);
      response.end();
      return;
    }
    const contentType = photoResponse.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await photoResponse.arrayBuffer());
    photoCache.set(photoName, { buffer, contentType, cachedAt: Date.now() });
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(buffer.length),
      "X-Cache": "MISS",
      ...BASE_HEADERS,
    });
    response.end(buffer);
  } catch (error) {
    logger.error("photo_proxy_error", { message: error.message });
    response.writeHead(502, BASE_HEADERS);
    response.end();
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(staticRoot, requestedPath));

  if (!filePath.startsWith(staticRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...BASE_HEADERS });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream", ...BASE_HEADERS });
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  if (request.url.startsWith("/api/places/search")) {
    handlePlacesSearch(request, response).catch((error) => {
      logger.error("unexpected_error", { message: error.message });
      sendJson(response, 500, providerError(500, "Error inesperado del servidor.", "SERVER_ERROR").body);
    });
    return;
  }

  if (request.url.startsWith("/api/places/photo")) {
    handlePhotoProxy(request, response).catch((error) => {
      logger.error("photo_proxy_unexpected_error", { message: error.message });
      response.writeHead(500, BASE_HEADERS);
      response.end();
    });
    return;
  }

  if (request.url.startsWith("/api/places/stats")) {
    handleStats(response);
    return;
  }

  serveStatic(request, response);
}).listen(port, "0.0.0.0", () => {
  logger.info("server_started", { url: `http://0.0.0.0:${port}`, config });

  // ── Optimización 14: cache warming al arrancar ───────────────────────────
  // Pre-pobla la caché para la ubicación por defecto con búsqueda vacía (Nearby Search).
  // Solo hace una llamada a Google si la caché está vacía para esa clave.
  if (googleMapsApiKey) {
    const defaultLat = 28.4636, defaultLon = -16.2518;
    const warmKey = getPlacesCacheKey("", defaultLat, defaultLon);
    const existing = getCachedPlaces(placesCacheDatabase, warmKey, config.cacheTtlMs);
    if (!existing) {
      const latS = snapToGridCenter(defaultLat);
      const lonS = snapToGridCenter(defaultLon);
      fetchAndCachePlaces(warmKey, "", latS, lonS, config.googlePlacesRadiusMeters, config.maxPlacesResults)
        .then((places) => logger.info("cache_warmed", { count: places.length }))
        .catch((err) => logger.warn("cache_warm_failed", { message: err.message }));
    }
  }
});
