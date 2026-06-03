import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanExpiredCache,
  createPlacesCacheDatabase,
  getCachedPlaces,
  getCacheStats,
  getPlacesCacheKey,
  isRateLimited,
  normalizeQueryForCache,
  setCachedPlaces,
  snapToGridCenter,
  validatePlacesPayload,
} from "../server-utils.mjs";

// ── getPlacesCacheKey ────────────────────────────────────────────────────────

test("getPlacesCacheKey normalizes query (trim, lowercase, diacritics) and snaps coords to cell center", () => {
  // snapToGridCenter(40.41681) = (floor(808.3362) + 0.5) / 20 = 808.5/20 = 40.425
  // snapToGridCenter(-3.70382) = (floor(-74.0764) + 0.5) / 20 = -74.5/20 = -3.725
  assert.equal(
    getPlacesCacheKey(" Burger ", 40.41681, -3.70382),
    JSON.stringify({ query: "burger", latCell: 40.425, lonCell: -3.725 }),
  );
});

test("normalizeQueryForCache strips diacritics", () => {
  assert.equal(normalizeQueryForCache("Café"), "cafe");
  assert.equal(normalizeQueryForCache(" Rincón "), "rincon");
});

test("snapToGridCenter returns the center of the 0.05° cell", () => {
  assert.equal(snapToGridCenter(28.4636), (Math.floor(28.4636 * 20) + 0.5) / 20);
  assert.equal(snapToGridCenter(-16.2518), (Math.floor(-16.2518 * 20) + 0.5) / 20);
});

// ── isRateLimited ────────────────────────────────────────────────────────────

test("isRateLimited allows requests under the configured limit", () => {
  const log = new Map();
  const config = { rateLimitMaxRequests: 2, rateLimitWindowMs: 1000 };

  assert.equal(isRateLimited(log, "client", 1000, config), false);
  assert.equal(isRateLimited(log, "client", 1100, config), false);
  assert.equal(isRateLimited(log, "client", 1200, config), true);
});

test("isRateLimited drops old hits outside the window", () => {
  const log = new Map([["client", [0, 100]]]);
  const config = { rateLimitMaxRequests: 2, rateLimitWindowMs: 1000 };

  assert.equal(isRateLimited(log, "client", 1500, config), false);
});

// ── validatePlacesPayload ────────────────────────────────────────────────────

test("validatePlacesPayload filters malformed places", () => {
  const validPlace = {
    id: "abc",
    displayName: { text: "Real Restaurant" },
    location: { latitude: 1, longitude: 2 },
  };
  const invalidPlace = {
    id: "broken",
    displayName: { text: "Broken" },
    location: { latitude: "nope", longitude: 2 },
  };

  assert.deepEqual(validatePlacesPayload({ places: [validPlace, invalidPlace] }), [validPlace]);
  assert.deepEqual(validatePlacesPayload({ places: null }), []);
});

// ── SQLite cache ─────────────────────────────────────────────────────────────

test("sqlite places cache stores and returns fresh results", () => {
  const database = createPlacesCacheDatabase(":memory:");
  const places = [{ id: "abc", displayName: { text: "Cached" }, location: { latitude: 1, longitude: 2 } }];

  setCachedPlaces(database, "key", places, 1000);

  // age = 500ms < ttlMs 5000ms → fresh
  const result = getCachedPlaces(database, "key", 5000, 1500);
  assert.deepEqual(result?.places, places);
  assert.equal(result?.stale, false);
});

test("sqlite places cache returns stale within grace window", () => {
  const database = createPlacesCacheDatabase(":memory:");
  const places = [{ id: "abc", displayName: { text: "Stale" }, location: { latitude: 1, longitude: 2 } }];

  setCachedPlaces(database, "key", places, 1000);

  // age = 1500ms > ttlMs 1000ms but < ttlMs*2 2000ms → stale
  const result = getCachedPlaces(database, "key", 1000, 2500);
  assert.deepEqual(result?.places, places);
  assert.equal(result?.stale, true);
});

test("sqlite places cache returns null after grace window expires", () => {
  const database = createPlacesCacheDatabase(":memory:");
  const places = [{ id: "abc", displayName: { text: "Expired" }, location: { latitude: 1, longitude: 2 } }];

  setCachedPlaces(database, "key", places, 1000);

  // age = 1000ms >= ttlMs*2 500*2 = 1000ms → null
  assert.equal(getCachedPlaces(database, "key", 500, 2000), null);
});

// ── cleanExpiredCache ────────────────────────────────────────────────────────

test("cleanExpiredCache removes entries older than 2× TTL", () => {
  const database = createPlacesCacheDatabase(":memory:");
  const places = [{ id: "x", displayName: { text: "Old" }, location: { latitude: 1, longitude: 2 } }];

  setCachedPlaces(database, "old", places, 0);     // created_at = 0
  setCachedPlaces(database, "new", places, 9999);  // created_at = 9999

  cleanExpiredCache(database, 1000, 10000); // cutoff = 10000 - 2000 = 8000

  assert.equal(getCachedPlaces(database, "old", 1000, 10000), null);
  assert.notEqual(getCachedPlaces(database, "new", 1000, 10000), null);
});

// ── getCacheStats ────────────────────────────────────────────────────────────

test("getCacheStats counts fresh, stale and expired entries", () => {
  const database = createPlacesCacheDatabase(":memory:");
  const p = [{ id: "x", displayName: { text: "X" }, location: { latitude: 1, longitude: 2 } }];

  setCachedPlaces(database, "fresh", p, 9000);  // age 1000ms < ttlMs 5000ms → fresh
  setCachedPlaces(database, "stale", p, 4000);  // age 6000ms > ttlMs 5000ms but < 10000ms → stale
  setCachedPlaces(database, "expired", p, 0);   // age 10000ms >= ttlMs*2 10000ms → expired

  const stats = getCacheStats(database, 5000, 10000);
  assert.equal(stats.total, 3);
  assert.equal(stats.fresh, 1);
  assert.equal(stats.stale, 1);
  assert.equal(stats.expired, 1);
});
