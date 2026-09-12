import "./styles.css";
import { appConfig } from "./config";
import { dom } from "./ui/dom";
import {
  hideLocationSuggestions,
  renderAppShell,
  renderLoading,
  renderLocationSuggestions,
  renderProviderEmptyState,
  renderResults,
  showRestaurantDetail,
  buildFavoriteMapsUrl,
} from "./ui/render";
import {
  addRecentSearch,
  addSmartHistory,
  removeFavorite,
  setOpenMapsInNewTab,
  setProviderError,
  setRestaurants,
  setSelectedRestaurant,
  setSortMode,
  setCurrentLocation,
  setView,
  state,
  subscribe,
  toggleFavorite,
  updateFavorite,
  updateSettings,
  clearLocalAppData,
} from "./state/store";
import { fetchNearbyRestaurants, getProviderErrorMessage } from "./providers/placesProvider";
import { fetchLocationSuggestions, getShortLocationName } from "./providers/geocodingProvider";
import type { GeocodingPlace } from "./types";
import { escapeHtml } from "./utils/format";
import { getDistanceKm } from "./utils/geo";

let locationSearchTimer = 0;
let activeLocationSuggestions: GeocodingPlace[] = [];

// ── Opt-18: deduplicación de búsqueda ────────────────────────────────────────
// Evita lanzar una petición si la query y la ubicación son idénticas a la última búsqueda.
let lastSearchKey = "";

async function loadNearbyRestaurants(): Promise<void> {
  const query = dom.dishInput.value.trim();
  const { latitude, longitude } = state.currentLocation;
  const radius = state.settings.defaultRadiusKm;

  // ── Opt-18: evita peticiones duplicadas cuando nada ha cambiado ────────────
  const searchKey = `${query}|${latitude}|${longitude}|${radius}`;
  if (searchKey === lastSearchKey && state.activeRestaurants.length > 0) return;
  renderLoading();
  try {
    // ── Opt-17: pasa el radio para que el servidor ajuste resultados y área ──
    const restaurants = await fetchNearbyRestaurants(query, latitude, longitude, radius);
    lastSearchKey = searchKey;
    setRestaurants(restaurants);
  } catch (error) {
    lastSearchKey = "";
    setProviderError(getProviderErrorMessage(error));
  }
}

function searchDish(dish: string): void {
  dom.dishInput.value = dish;
  setSelectedRestaurant(null);
  addRecentSearch(dish);
  addSmartHistory(dish);
  void loadNearbyRestaurants();
}

async function searchLocations(query: string, useFirstResult = false): Promise<void> {
  const cleanQuery = query.trim();

  if (cleanQuery.length < appConfig.location.geocoderMinChars) {
    activeLocationSuggestions = [];
    hideLocationSuggestions();
    dom.locationDetail.textContent = "Escribe al menos 3 caracteres para buscar una ubicación.";
    return;
  }

  dom.locationDetail.textContent = "Buscando ubicaciones en todo el mundo...";

  try {
    const places = await fetchLocationSuggestions(cleanQuery);
    activeLocationSuggestions = places;
    if (useFirstResult && places[0]) {
      setLocationFromPlace(places[0]);
      return;
    }

    renderLocationSuggestions(places, getShortLocationName);
    dom.locationDetail.textContent = places.length ? "Elige una ubicación de las sugerencias." : "No se encontró una ubicación.";
  } catch {
    activeLocationSuggestions = [];
    hideLocationSuggestions();
    dom.locationTitle.textContent = "Búsqueda de ubicación no disponible";
    dom.locationDetail.textContent = "Inténtalo más tarde o usa tu ubicación actual.";
  }
}

function scheduleLocationSearch(): void {
  window.clearTimeout(locationSearchTimer);
  locationSearchTimer = window.setTimeout(() => {
    void searchLocations(dom.locationInput.value);
  }, appConfig.location.geocoderDelayMs);
}

function setLocationFromPlace(place: GeocodingPlace): void {
  setSelectedRestaurant(null);
  setCurrentLocation(getShortLocationName(place), Number(place.lat), Number(place.lon));
  dom.locationInput.value = place.display_name;
  dom.locationTitle.textContent = `Usando ${state.currentLocation.label}`;
  dom.locationDetail.textContent = "Resultados ordenados por distancia desde esta ubicación.";
  activeLocationSuggestions = [];
  hideLocationSuggestions();
  void loadNearbyRestaurants();
}

function requestLocation(): void {
  const geolocation = window.navigator?.geolocation;

  if (!window.isSecureContext) {
    dom.locationTitle.textContent = "Ubicación bloqueada";
    dom.locationDetail.textContent = "La ubicación del navegador necesita HTTPS o localhost. Busca tu ciudad.";
    return;
  }

  if (!geolocation) {
    dom.locationTitle.textContent = "Ubicación no disponible";
    dom.locationDetail.textContent = "Este navegador no ofrece acceso a ubicación. Busca tu ciudad.";
    return;
  }

  dom.locationTitle.textContent = "Solicitando ubicación";
  dom.locationDetail.textContent = "El navegador puede pedirte permiso.";
  dom.locationButton.disabled = true;

  geolocation.getCurrentPosition(
    (position) => {
      setSelectedRestaurant(null);
      setCurrentLocation("Tu ubicación", position.coords.latitude, position.coords.longitude);
      dom.locationTitle.textContent = "Usando tu ubicación";
      dom.locationDetail.textContent = "Resultados ordenados por distancia desde ti.";
      dom.locationButton.disabled = false;
      void loadNearbyRestaurants();
    },
    (error) => {
      const messages: Record<number, string> = {
        1: "Permiso de ubicación denegado. Actívalo en el navegador o busca tu ciudad.",
        2: "No se pudo detectar tu posición. Busca tu ciudad e inténtalo más tarde.",
        3: "La búsqueda de ubicación tardó demasiado. Busca tu ciudad o inténtalo de nuevo.",
      };
      dom.locationTitle.textContent = "Ubicación no activa";
      dom.locationDetail.textContent = messages[error.code] || "No se pudo activar la ubicación. Busca tu ciudad.";
      dom.locationButton.disabled = false;
    },
    { enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 },
  );
}

function getRestaurantById(id: string) {
  return state.activeRestaurants.find((restaurant) => restaurant.id === id);
}

function showFavoriteComparison(): void {
  const selectedIds = Array.from(document.querySelectorAll<HTMLInputElement>("[data-compare-favorite]:checked"))
    .map((input) => input.dataset.compareFavorite)
    .filter((id): id is string => Boolean(id))
    .slice(0, 3);

  if (selectedIds.length < 2) {
    dom.detailContent.innerHTML = `
      <h2>Comparador</h2>
      <p>Selecciona al menos 2 favoritos para comparar.</p>
    `;
    dom.detailDialog.showModal();
    return;
  }

  const favorites = selectedIds
    .map((id) => state.favorites.find((favorite) => favorite.id === id))
    .filter((favorite): favorite is NonNullable<typeof favorite> => Boolean(favorite));

  dom.detailContent.innerHTML = `
    <h2>Comparador de favoritos</h2>
    <div class="comparison-grid">
      ${favorites
        .map((favorite) => {
          const restaurant = getRestaurantById(favorite.id);
          const distance = restaurant ? `${getDistanceKm(state.currentLocation, restaurant).toFixed(1)} km` : "Requiere búsqueda";
          return `
            <article>
              <h3>${escapeHtml(favorite.name)}</h3>
              <p><strong>Distancia:</strong> ${escapeHtml(distance)}</p>
              <p><strong>Lista:</strong> ${escapeHtml(favorite.list || "Pendientes")}</p>
              <p><strong>Etiquetas:</strong> ${escapeHtml((favorite.tags || []).join(", ") || "Sin etiquetas")}</p>
              <p><strong>Nota:</strong> ${escapeHtml(favorite.note || "Sin nota")}</p>
              <p><strong>Apertura:</strong> ver en Maps</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
  dom.detailDialog.showModal();
}

function exportFavoritesBackup(): void {
  const backup = {
    exportedAt: new Date().toISOString(),
    favorites: state.favorites,
    version: appConfig.appVersion,
  };
  const json = JSON.stringify(backup, null, 2);
  void window.navigator.clipboard?.writeText(json);
  dom.detailContent.innerHTML = `
    <h2>Backup preparado</h2>
    <p>Se ha copiado un backup JSON de tus favoritos al portapapeles cuando el navegador lo permite.</p>
    <textarea class="backup-output" rows="8" readonly>${escapeHtml(json)}</textarea>
  `;
  dom.detailDialog.showModal();
}

async function shareFavorite(id: string): Promise<void> {
  const favorite = state.favorites.find((item) => item.id === id);
  if (!favorite) return;

  const url = buildFavoriteMapsUrl(favorite);
  const text = `${favorite.name} - ${favorite.area}`;
  if (window.navigator.share) {
    await window.navigator.share({ text, title: favorite.name, url });
    return;
  }

  await window.navigator.clipboard?.writeText(`${text}\n${url}`);
  dom.detailContent.innerHTML = `
    <h2>Favorito copiado</h2>
    <p>El enlace se ha copiado al portapapeles cuando el navegador lo permite.</p>
  `;
  dom.detailDialog.showModal();
}

subscribe(() => {
  renderAppShell();
  renderResults();
});

dom.searchButton.addEventListener("click", () => searchDish(dom.dishInput.value));
dom.dishInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchDish(dom.dishInput.value);
});
dom.priceFilter.addEventListener("change", () => {
  const budgetByPrice: Record<string, "any" | "cheap" | "medium" | "premium"> = {
    all: "any",
    "10": "cheap",
    "15": "medium",
    "20": "premium",
  };
  updateSettings({ budgetLevel: budgetByPrice[dom.priceFilter.value] || "any" });
});
dom.distanceFilter.addEventListener("change", () => {
  const value = dom.distanceFilter.value;
  { const n = Number(value); if (!isNaN(n) && n > 0) updateSettings({ defaultRadiusKm: value }); }
});
dom.sortFilter.addEventListener("change", () => {
  const value = dom.sortFilter.value;
  if (value === "best" || value === "favorites" || value === "nearest") setSortMode(value);
});
dom.locationButton.addEventListener("click", requestLocation);
dom.locationInput.addEventListener("input", scheduleLocationSearch);
dom.locationInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void searchLocations(dom.locationInput.value, true);
  if (event.key === "Escape") hideLocationSuggestions();
});
dom.avatarButton.addEventListener("click", () => setView("profile"));
dom.handoffSetting.addEventListener("change", () => {
  setOpenMapsInNewTab(dom.handoffSetting.checked);
});
dom.languageSetting.addEventListener("change", () => {
  const value = dom.languageSetting.value;
  if (value === "es" || value === "en" || value === "fr" || value === "de" || value === "it" || value === "pt") {
    updateSettings({ language: value });
  }
});
dom.radiusSetting.addEventListener("change", () => {
  const value = dom.radiusSetting.value;
  { const n = Number(value); if (!isNaN(n) && n > 0) updateSettings({ defaultRadiusKm: value }); }
});
dom.budgetSetting.addEventListener("change", () => {
  const value = dom.budgetSetting.value;
  if (value === "any" || value === "cheap" || value === "medium" || value === "premium") updateSettings({ budgetLevel: value });
});
dom.mapsModeSetting.addEventListener("change", () => {
  const value = dom.mapsModeSetting.value;
  if (value === "new-tab" || value === "same-tab" || value === "external-app") updateSettings({ mapsMode: value });
});
dom.developerModeSetting.addEventListener("change", () => {
  updateSettings({ developerMode: dom.developerModeSetting.checked });
});
dom.applyPreferencesButton.addEventListener("click", () => {
  const foodPreferences = Array.from(dom.foodPreferenceInputs)
    .filter((input) => input.checked)
    .map((input) => input.value);
  updateSettings({ foodPreferences });
  if (foodPreferences.length) searchDish(foodPreferences.join(" "));
});
dom.clearDataButton.addEventListener("click", () => {
  clearLocalAppData();
  dom.dishInput.value = "";
  dom.locationInput.value = "";
  void loadNearbyRestaurants();
});
dom.detailClose.addEventListener("click", () => dom.detailDialog.close());
dom.detailContent.addEventListener("click", (event) => {
  const favoriteButton = (event.target as Element).closest<HTMLButtonElement>("[data-favorite]");
  if (favoriteButton?.dataset.favorite) toggleFavorite(favoriteButton.dataset.favorite);
});

document.addEventListener("click", (event) => {
  const target = event.target as Element;
  const navButton = target.closest<HTMLButtonElement>("[data-nav-view]");
  if (navButton?.dataset.navView) {
    const view = navButton.dataset.navView;
    if (view === "explore" || view === "favorites" || view === "profile") setView(view);
    return;
  }

  const dishButton = target.closest<HTMLButtonElement>("[data-dish]");
  if (dishButton?.dataset.dish) {
    searchDish(dishButton.dataset.dish);
    return;
  }

  const recentButton = target.closest<HTMLButtonElement>("[data-recent]");
  if (recentButton?.dataset.recent) searchDish(recentButton.dataset.recent);
});

dom.resultsList.addEventListener("click", (event) => {
  const target = event.target as Element;
  const selectButton = target.closest<HTMLButtonElement>("[data-select]");
  const detailButton = target.closest<HTMLButtonElement>("[data-detail]");
  const favoriteButton = target.closest<HTMLButtonElement>("[data-favorite]");

  if (selectButton?.dataset.select) {
    setSelectedRestaurant(selectButton.dataset.select);
    setView("explore");
    return;
  }
  if (detailButton?.dataset.detail) {
    const restaurant = getRestaurantById(detailButton.dataset.detail);
    if (restaurant) showRestaurantDetail(restaurant);
  }
  if (favoriteButton?.dataset.favorite) toggleFavorite(favoriteButton.dataset.favorite);
});

dom.mapPlaceList.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-select]");
  if (button?.dataset.select) setSelectedRestaurant(button.dataset.select);
});

document.querySelector("#favorites-panel")?.addEventListener("click", (event) => {
  const target = event.target as Element;
  const removeButton = target.closest<HTMLButtonElement>("[data-remove-favorite]");
  const compareButton = target.closest<HTMLButtonElement>("[data-compare-favorites]");
  const exportButton = target.closest<HTMLButtonElement>("[data-export-favorites]");
  const shareButton = target.closest<HTMLButtonElement>("[data-share-favorite]");

  if (removeButton?.dataset.removeFavorite) removeFavorite(removeButton.dataset.removeFavorite);
  if (compareButton) showFavoriteComparison();
  if (exportButton) exportFavoritesBackup();
  if (shareButton?.dataset.shareFavorite) void shareFavorite(shareButton.dataset.shareFavorite);
});

document.querySelector("#favorites-panel")?.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  if (target.matches("[data-favorite-sort]")) {
    const value = target.value;
    if (value === "recent" || value === "distance" || value === "name" || value === "list") updateSettings({ favoriteSortMode: value });
  }

  if (target.matches("[data-favorite-list-filter]")) updateSettings({ favoriteListFilter: target.value });
  if (target.matches("[data-favorite-near-only]")) updateSettings({ favoriteNearOnly: (target as HTMLInputElement).checked });
  if (target.matches("[data-favorite-list]")) updateFavorite(target.dataset.favoriteList || "", { list: target.value });
  if (target.matches("[data-favorite-note]")) updateFavorite(target.dataset.favoriteNote || "", { note: target.value.trim() });
  if (target.matches("[data-favorite-tags]")) {
    const tags = target.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    updateFavorite(target.dataset.favoriteTags || "", { tags });
  }
});

dom.locationSuggestions.addEventListener("click", (event) => {
  const option = (event.target as Element).closest<HTMLButtonElement>("[data-location-index]");
  if (!option?.dataset.locationIndex) return;

  const place = activeLocationSuggestions[Number(option.dataset.locationIndex)];
  if (place) setLocationFromPlace(place);
});

if ("serviceWorker" in window.navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("/sw.js").catch(() => {
      dom.locationDetail.textContent = "No se pudo activar el modo sin conexión en este navegador.";
    });
  });
}

renderAppShell();
void loadNearbyRestaurants();
