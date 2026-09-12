import { appConfig } from "../config";
import type { GooglePlace, Restaurant } from "../types";
import { apiRequest, ApiError } from "../api/client";
import { normalizeText } from "../utils/format";

type PlacesResponse = {
  cached?: boolean;
  places?: GooglePlace[];
};

const PLACES_SESSION_TTL_MS = 5 * 60 * 1000;
const sessionCache = new Map<string, { results: Restaurant[]; at: number }>();

function getSessionKey(query: string, latitude: number, longitude: number, radiusKm: string): string {
  const latCell = (Math.floor(latitude * 20) + 0.5) / 20;
  const lonCell = (Math.floor(longitude * 20) + 0.5) / 20;
  return `${normalizeText(query)}:${latCell}:${lonCell}:r${radiusKm}`;
}

function fromSessionCache(key: string): Restaurant[] | null {
  const entry = sessionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > PLACES_SESSION_TTL_MS) {
    sessionCache.delete(key);
    return null;
  }
  return entry.results;
}

export function getProviderErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "La búsqueda de restaurantes no está disponible.";

  const messages: Record<string, string> = {
    BAD_LOCATION: "La ubicación seleccionada no es válida. Busca otra ciudad o dirección.",
    GOOGLE_KEY_MISSING: "Google Places no está configurado. Añade GOOGLE_MAPS_API_KEY en el servidor.",
    GOOGLE_PLACES_ERROR: error.message || "Google Places rechazó la solicitud.",
    NETWORK_ERROR: "No se puede conectar con el servidor de búsqueda.",
    RATE_LIMITED: "Demasiadas búsquedas. Espera un minuto e inténtalo de nuevo.",
    REQUEST_TIMEOUT: "La búsqueda de restaurantes tardó demasiado. Inténtalo de nuevo.",
    SERVER_ERROR: "El servidor de búsqueda falló. Inténtalo más tarde.",
  };

  return messages[error.code] || error.message || "La búsqueda de restaurantes no está disponible.";
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      return fn();
    }
    throw error;
  }
}

export async function fetchNearbyRestaurants(
  query: string,
  latitude: number,
  longitude: number,
  radiusKm: string = "all",
): Promise<Restaurant[]> {
  const sessionKey = getSessionKey(query, latitude, longitude, radiusKm);
  const cached = fromSessionCache(sessionKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    query: query.trim(),
    radius: radiusKm,
  });
  const data = await withRetry(() =>
    apiRequest<PlacesResponse>(`${appConfig.api.placesSearchPath}?${params.toString()}`),
  );
  const results = (data.places || []).map((place) => normalizeGooglePlace(place, query)).filter(isValidRestaurant);
  sessionCache.set(sessionKey, { results, at: Date.now() });
  return results;
}

const priceLevelLabels: Record<string, string> = {
  PRICE_LEVEL_FREE: "Gratis",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

function normalizeGooglePlace(place: GooglePlace, query: string): Restaurant {
  const location = place.location || {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const primaryType = (place.primaryTypeDisplayName?.text || place.primaryType || "Restaurante").replaceAll("_", " ");

  // Rango de precio real de Google (ej. "€10–20"). Símbolo según moneda.
  let priceRange: string | undefined;
  const range = place.priceRange;
  if (range?.startPrice?.units || range?.endPrice?.units) {
    const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
    const sym = symbols[range.startPrice?.currencyCode || range.endPrice?.currencyCode || "EUR"] || "";
    const start = range.startPrice?.units;
    const end = range.endPrice?.units;
    priceRange = start && end ? `${sym}${start}–${end}` : `${sym}${start || end}`;
  }

  return {
    area: place.formattedAddress || primaryType,
    foods: [
      {
        aliases: [query || "comida"],
        dish: query || "comida",
        name: `${query || "Comida"} cercana`,
        price: null,
      },
    ],
    googleMapsUri: place.googleMapsUri,
    id: place.id || place.name || `${place.displayName?.text}-${latitude}-${longitude}`,
    latitude,
    longitude,
    name: place.displayName?.text || "Restaurante sin nombre",
    openNow: place.regularOpeningHours?.openNow,
    phoneNumber: place.internationalPhoneNumber,
    photoName: place.photos?.[0]?.name,
    priceLevel: place.priceLevel ? priceLevelLabels[place.priceLevel] : undefined,
    priceRange,
    rating: place.rating,
    sourceLabel: primaryType,
    userRatingCount: place.userRatingCount,
    websiteUri: place.websiteUri,
  };
}

function isValidRestaurant(place: Restaurant): boolean {
  return Boolean(place.id && place.name && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}
