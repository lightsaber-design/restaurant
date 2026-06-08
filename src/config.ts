import type { LocationPoint, ViewName } from "./types";

// For Android emulator the host machine is at 10.0.2.2.
// For a physical device set EXPO_PUBLIC_API_URL to your machine's LAN IP, e.g. http://192.168.1.x:4173
const apiBaseUrl =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) || "http://10.0.2.2:4173";

export const appConfig = {
  appVersion: "0.2.0",
  api: {
    baseUrl: apiBaseUrl,
    placesSearchPath: "/api/places/search",
  },
  location: {
    defaultPoint: {
      label: "Santa Cruz de Tenerife",
      latitude: 28.4636,
      longitude: -16.2518,
    } satisfies LocationPoint,
    geocoderDelayMs: 700,
    geocoderMinChars: 3,
    geocoderRateLimitMs: 1100,
  },
  storageKeys: {
    favorites: "savvyfoodie:favorites",
    history: "savvyfoodie:history",
    lastLocation: "savvyfoodie:last-location",
    recentSearches: "savvyfoodie:recent-searches",
    savedCategories: "savvyfoodie:saved-categories",
    settings: "savvyfoodie:settings",
  },
  ui: {
    defaultView: "explore" as ViewName,
  },
};
