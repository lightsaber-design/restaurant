import { appConfig } from "../config";
import type { GeocodingPlace } from "../types";
import { normalizeText } from "../utils/format";

const GEOCODING_CACHE_MAX = 50;
const locationSearchCache = new Map<string, GeocodingPlace[]>();
let lastLocationSearchAt = 0;

export function getShortLocationName(place: GeocodingPlace): string {
  const address = place.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state ||
    place.name ||
    place.display_name.split(",")[0] ||
    "Ubicación seleccionada"
  );
}

export async function fetchLocationSuggestions(query: string): Promise<GeocodingPlace[]> {
  const normalizedQuery = normalizeText(query);
  const cached = locationSearchCache.get(normalizedQuery);
  if (cached) return cached;

  const elapsed = Date.now() - lastLocationSearchAt;
  if (elapsed < appConfig.location.geocoderRateLimitMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, appConfig.location.geocoderRateLimitMs - elapsed));
  }

  const params = new URLSearchParams({
    addressdetails: "1",
    format: "jsonv2",
    limit: "5",
    q: query,
  });

  lastLocationSearchAt = Date.now();
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error("Falló la búsqueda de ubicación");

  const places = (await response.json()) as GeocodingPlace[];
  if (locationSearchCache.size >= GEOCODING_CACHE_MAX) {
    locationSearchCache.delete(locationSearchCache.keys().next().value!);
  }
  locationSearchCache.set(normalizedQuery, places);
  return places;
}
