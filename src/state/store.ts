import { appConfig } from "../config";
import { loadStoredArray, loadStoredObject, removeStoredValue, saveStoredValue } from "../storage";
import type { AppState, FavoriteRestaurant, Restaurant, SearchHistoryItem, ViewName } from "../types";
import { normalizeText } from "../utils/format";

const listeners = new Set<(state: AppState) => void>();
const defaultSettings: AppState["settings"] = {
  budgetLevel: "any",
  defaultRadiusKm: "all",
  developerMode: false,
  favoriteListFilter: "all",
  favoriteNearOnly: false,
  favoriteSortMode: "recent",
  foodPreferences: [],
  language: "es",
  mapsMode: "new-tab",
  maxPrice: "all",
  openMapsInNewTab: true,
  openNow: true,
  sortMode: "best",
};

export const state: AppState = {
  activeRestaurants: [],
  currentLocation: { ...appConfig.location.defaultPoint },
  favorites: [],
  pendingSearch: null,
  providerErrorMessage: "",
  recentSearches: ["Ramen tonkotsu", "Tacos al pastor", "Café helado"],
  savedCategories: [],
  selectedRestaurantId: null,
  settings: { ...defaultSettings },
  view: appConfig.ui.defaultView,
};

export async function initStore(): Promise<void> {
  const [location, favorites, storedSearches, savedCategories, settings] = await Promise.all([
    loadStoredObject(appConfig.storageKeys.lastLocation, { ...appConfig.location.defaultPoint }),
    loadStoredArray<FavoriteRestaurant>(appConfig.storageKeys.favorites),
    loadStoredArray<string>(appConfig.storageKeys.recentSearches),
    loadStoredArray<string>(appConfig.storageKeys.savedCategories),
    loadStoredObject(appConfig.storageKeys.settings, { ...defaultSettings }),
  ]);
  state.currentLocation = location;
  state.favorites = favorites;
  state.recentSearches = storedSearches.length ? storedSearches : ["Ramen tonkotsu", "Tacos al pastor", "Café helado"];
  state.savedCategories = savedCategories;
  state.settings = settings;
  notify();
}

export function subscribe(listener: (nextState: AppState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  listeners.forEach((listener) => listener(state));
}

export function setView(view: ViewName): void {
  state.view = view;
  notify();
}

export function setRestaurants(restaurants: Restaurant[]): void {
  state.activeRestaurants = restaurants;
  state.providerErrorMessage = "";
  state.selectedRestaurantId = null;
  notify();
}

export function setProviderError(message: string): void {
  state.activeRestaurants = [];
  state.providerErrorMessage = message;
  state.selectedRestaurantId = null;
  notify();
}

export function setSelectedRestaurant(id: string | null): void {
  state.selectedRestaurantId = id;
  notify();
}

export function addRecentSearch(dish: string): void {
  const cleanDish = dish.trim();
  if (!cleanDish) return;
  state.recentSearches = [
    cleanDish,
    ...state.recentSearches.filter((item) => normalizeText(item) !== normalizeText(cleanDish)),
  ].slice(0, 5);
  void saveStoredValue(appConfig.storageKeys.recentSearches, state.recentSearches);
  notify();
}

export function triggerSearch(dish: string): void {
  state.pendingSearch = dish.trim();
  state.view = "explore";
  notify();
}

export function clearPendingSearch(): void {
  state.pendingSearch = null;
  notify();
}

export function saveCategory(dish: string): void {
  const clean = dish.trim();
  if (!clean || state.savedCategories.includes(clean)) return;
  state.savedCategories = [clean, ...state.savedCategories];
  void saveStoredValue(appConfig.storageKeys.savedCategories, state.savedCategories);
  notify();
}

export function removeCategory(dish: string): void {
  state.savedCategories = state.savedCategories.filter((c) => c !== dish);
  void saveStoredValue(appConfig.storageKeys.savedCategories, state.savedCategories);
  notify();
}

export function addSmartHistory(dish: string): void {
  const cleanDish = dish.trim();
  if (!cleanDish) return;
  void loadStoredArray<SearchHistoryItem>(appConfig.storageKeys.history).then((history) => {
    const filtered = history.filter((item) => {
      return normalizeText(item.dish) !== normalizeText(cleanDish) || item.location !== state.currentLocation.label;
    });
    filtered.unshift({
      dish: cleanDish,
      location: state.currentLocation.label,
      searchedAt: new Date().toISOString(),
    });
    void saveStoredValue(appConfig.storageKeys.history, filtered.slice(0, 30));
  });
}

export function setCurrentLocation(label: string, latitude: number, longitude: number): void {
  state.currentLocation = { label, latitude, longitude };
  void saveStoredValue(appConfig.storageKeys.lastLocation, state.currentLocation);
  notify();
}

export function isFavorite(id: string): boolean {
  return state.favorites.some((item) => item.id === id);
}

export function toggleFavorite(id: string): void {
  const restaurant = state.activeRestaurants.find((item) => item.id === id);
  if (!restaurant) return;

  if (isFavorite(id)) {
    state.favorites = state.favorites.filter((item) => item.id !== id);
  } else {
    state.favorites.unshift({
      area: restaurant.area,
      googleMapsUri: restaurant.googleMapsUri,
      id: restaurant.id,
      latitude: restaurant.latitude,
      list: "Pendientes",
      longitude: restaurant.longitude,
      name: restaurant.name,
      note: "",
      savedAt: new Date().toISOString(),
      tags: [],
    });
  }
  void saveStoredValue(appConfig.storageKeys.favorites, state.favorites);
  notify();
}

export function removeFavorite(id: string): void {
  state.favorites = state.favorites.filter((item) => item.id !== id);
  void saveStoredValue(appConfig.storageKeys.favorites, state.favorites);
  notify();
}

export function updateFavorite(id: string, updates: Partial<FavoriteRestaurant>): void {
  state.favorites = state.favorites.map((item) => (item.id !== id ? item : { ...item, ...updates }));
  void saveStoredValue(appConfig.storageKeys.favorites, state.favorites);
  notify();
}

export function setOpenMapsInNewTab(value: boolean): void {
  state.settings = { ...state.settings, mapsMode: value ? "new-tab" : "same-tab", openMapsInNewTab: value };
  void saveStoredValue(appConfig.storageKeys.settings, state.settings);
  notify();
}

export function setSortMode(sortMode: AppState["settings"]["sortMode"]): void {
  state.settings = { ...state.settings, sortMode };
  void saveStoredValue(appConfig.storageKeys.settings, state.settings);
  notify();
}

export function updateSettings(nextSettings: Partial<AppState["settings"]>): void {
  const mapsMode = nextSettings.mapsMode || state.settings.mapsMode;
  state.settings = {
    ...state.settings,
    ...nextSettings,
    mapsMode,
    openMapsInNewTab: mapsMode !== "same-tab",
  };
  void saveStoredValue(appConfig.storageKeys.settings, state.settings);
  notify();
}

export async function clearLocalAppData(): Promise<void> {
  await Promise.all([
    removeStoredValue(appConfig.storageKeys.favorites),
    removeStoredValue(appConfig.storageKeys.history),
    removeStoredValue(appConfig.storageKeys.lastLocation),
    removeStoredValue(appConfig.storageKeys.recentSearches),
    removeStoredValue(appConfig.storageKeys.settings),
  ]);
  state.activeRestaurants = [];
  state.currentLocation = { ...appConfig.location.defaultPoint };
  state.favorites = [];
  state.providerErrorMessage = "";
  state.recentSearches = [];
  state.selectedRestaurantId = null;
  state.settings = { ...defaultSettings };
  notify();
}
