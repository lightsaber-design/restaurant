export type ViewName = "explore" | "map" | "favorites" | "profile";

export type LocationPoint = {
  label: string;
  latitude: number;
  longitude: number;
};

export type FoodMatch = {
  aliases: string[];
  dish: string;
  name: string;
  price: number | null;
};

export type Restaurant = {
  area: string;
  distanceKm?: number;
  foods: FoodMatch[];
  googleMapsUri?: string;
  id: string;
  latitude: number;
  longitude: number;
  matchedFood?: FoodMatch;
  name: string;
  openNow?: boolean;
  phoneNumber?: string;
  photoName?: string;
  priceLevel?: string;
  rating?: number;
  sourceLabel: string;
  userRatingCount?: number;
  websiteUri?: string;
};

export type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  internationalPhoneNumber?: string;
  location?: {
    latitude?: number | string;
    longitude?: number | string;
  };
  name?: string;
  photos?: Array<{ name?: string }>;
  priceLevel?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  userRatingCount?: number;
  websiteUri?: string;
};

export type GeocodingPlace = {
  address?: Record<string, string>;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
};

export type FavoriteRestaurant = {
  area: string;
  googleMapsUri?: string;
  id: string;
  latitude?: number;
  list?: string;
  longitude?: number;
  name: string;
  note?: string;
  savedAt: string;
  tags?: string[];
};

export type SearchHistoryItem = {
  dish: string;
  location: string;
  searchedAt: string;
};

export type AppSettings = {
  budgetLevel: "any" | "cheap" | "medium" | "premium";
  defaultRadiusKm: "all" | "1" | "3" | "5";
  developerMode: boolean;
  favoriteListFilter: string;
  favoriteNearOnly: boolean;
  favoriteSortMode: "recent" | "distance" | "name" | "list";
  foodPreferences: string[];
  language: "es" | "en" | "fr" | "de" | "it" | "pt";
  mapsMode: "new-tab" | "same-tab" | "external-app";
  openMapsInNewTab: boolean;
  sortMode: "best" | "favorites" | "nearest";
};

export type AppState = {
  activeRestaurants: Restaurant[];
  currentLocation: LocationPoint;
  favorites: FavoriteRestaurant[];
  providerErrorMessage: string;
  recentSearches: string[];
  selectedRestaurantId: string | null;
  settings: AppSettings;
  view: ViewName;
};
