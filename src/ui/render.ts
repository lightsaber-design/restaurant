import { dom } from "./dom";
import { state } from "../state/store";
import type { FavoriteRestaurant, GeocodingPlace, Restaurant } from "../types";
import { escapeHtml, formatCount, formatCurrency } from "../utils/format";
import { getDistanceKm } from "../utils/geo";
import { appConfig } from "../config";
import { getFilteredResults } from "../selectors";
import { isFavorite } from "../state/store";

// ── Opt-19: IntersectionObserver para cargar fotos solo cuando son visibles ──
// Evita peticiones al proxy de fotos para tarjetas fuera del viewport.
let _photoObserver: IntersectionObserver | null = null;

function getPhotoObserver(): IntersectionObserver {
  if (!_photoObserver) {
    _photoObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target as HTMLImageElement;
          const photoName = img.dataset.photo;
          if (photoName) {
            img.src = `/api/places/photo?name=${encodeURIComponent(photoName)}`;
            img.removeAttribute("data-photo");
          }
          _photoObserver?.unobserve(img);
        }
      },
      { rootMargin: "120px" }, // empieza a cargar 120 px antes de entrar en pantalla
    );
  }
  return _photoObserver;
}

export function observePhotos(): void {
  _photoObserver?.disconnect();
  _photoObserver = null;
  const observer = getPhotoObserver();
  document.querySelectorAll<HTMLImageElement>("[data-photo]").forEach((img) => observer.observe(img));
}

export function buildMapsUrl(restaurant: Restaurant, mode = "search"): string {
  if (restaurant.googleMapsUri && mode === "search") return restaurant.googleMapsUri;

  const encodedName = encodeURIComponent(`${restaurant.name} ${restaurant.area}`);
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
}

export function buildFavoriteMapsUrl(favorite: FavoriteRestaurant, mode = "search"): string {
  if (favorite.googleMapsUri && mode === "search") return favorite.googleMapsUri;
  const encodedName = encodeURIComponent(`${favorite.name} ${favorite.area}`);
  if (mode === "directions") {
    const destination =
      favorite.latitude != null && favorite.longitude != null
        ? `${favorite.latitude},${favorite.longitude}`
        : encodedName;
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
}

export function renderAppShell(): void {
  dom.views.forEach((view) => {
    const isActive = view.dataset.view === state.view;
    view.hidden = !isActive;
    view.classList.toggle("is-active", isActive);
  });

  dom.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navView === state.view);
  });

  dom.handoffSetting.checked = state.settings.openMapsInNewTab;
  dom.languageSetting.value = state.settings.language;
  dom.radiusSetting.value = state.settings.defaultRadiusKm;
  dom.budgetSetting.value = state.settings.budgetLevel;
  dom.mapsModeSetting.value = state.settings.mapsMode;
  dom.developerModeSetting.checked = state.settings.developerMode;
  dom.developerPanel.hidden = !state.settings.developerMode;
  dom.sortFilter.value = state.settings.sortMode;
  dom.distanceFilter.value = state.settings.defaultRadiusKm;
  applyBudgetToPriceFilter();
  dom.foodPreferenceInputs.forEach((input) => {
    input.checked = state.settings.foodPreferences.includes(input.value);
  });
  dom.currentLocationChip.textContent = state.currentLocation.label;
  updateCurrentSearchMapsLink();
  renderConnectionStatus();
  renderDeveloperPanel();
  renderFavorites();
}

export function renderLoading(): void {
  dom.resultsList.innerHTML = `
    <div class="skeleton-card" aria-label="Cargando restaurantes">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
    <div class="skeleton-card" aria-label="Cargando restaurantes">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;
  dom.resultCount.textContent = "Cargando";
  updateCurrentSearchMapsLink();
}

export function renderProviderEmptyState(message: string): void {
  const mapsQuery = encodeURIComponent(`${dom.dishInput.value || "restaurante"} cerca de ${state.currentLocation.label}`);
  dom.resultsList.innerHTML = `
    <div class="empty-state">
      <h3>Google Places no está conectado</h3>
      <p>${escapeHtml(message || "Configura el proxy de Google Maps Places para mostrar nombres reales de restaurantes aquí.")}</p>
      <a href="https://www.google.com/maps/search/${mapsQuery}" target="_blank" rel="noreferrer">Abrir Google Maps</a>
    </div>
  `;
  dom.resultCount.textContent = "API necesaria";
  dom.mapFrame.src = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  dom.selectedSummary.innerHTML = "<p>Los datos reales de restaurantes aparecerán cuando Google Places esté configurado.</p>";
  dom.mapPlaceList.innerHTML = "";
  updateCurrentSearchMapsLink();
}

export function renderResults(): void {
  if (state.providerErrorMessage && state.activeRestaurants.length === 0) {
    renderProviderEmptyState(state.providerErrorMessage);
    return;
  }

  const results = getFilteredResults(dom.dishInput.value, dom.priceFilter.value, dom.distanceFilter.value);
  if (results.length === 0) {
    renderNoResults();
    return;
  }

  if (!results.some((restaurant) => restaurant.id === state.selectedRestaurantId)) {
    state.selectedRestaurantId = results[0]?.id || null;
  }

  dom.resultCount.textContent = `${results.length} ${results.length === 1 ? "lugar" : "lugares"}`;
  dom.resultsList.innerHTML = results.map(renderRestaurantCard).join("");
  observePhotos(); // ── Opt-19: activa el observer sobre las nuevas tarjetas

  const selectedRestaurant = results.find((restaurant) => restaurant.id === state.selectedRestaurantId) || results[0];
  if (selectedRestaurant) renderSelectedRestaurant(selectedRestaurant, results);
}

function renderRestaurantCard(restaurant: Restaurant): string {
  const matchedFood = restaurant.matchedFood;
  const isSelected = restaurant.id === state.selectedRestaurantId;
  const favoriteLabel = isFavorite(restaurant.id) ? "Guardado" : "Guardar";
  const target = state.settings.openMapsInNewTab ? "_blank" : "_self";

  const ratingHtml = restaurant.rating
    ? `<span>★ ${restaurant.rating.toFixed(1)}${restaurant.userRatingCount ? ` (${formatCount(restaurant.userRatingCount)})` : ""}</span>`
    : "";
  const priceLevelHtml = restaurant.priceLevel ? `<span>${escapeHtml(restaurant.priceLevel)}</span>` : "";
  const openNowHtml =
    restaurant.openNow !== undefined
      ? `<span class="badge-open-status ${restaurant.openNow ? "is-open" : "is-closed"}">${restaurant.openNow ? "Abierto" : "Cerrado"}</span>`
      : "";
  // data-photo en lugar de src: el IntersectionObserver asigna src solo cuando la tarjeta
  // entra en el viewport, evitando peticiones innecesarias al proxy de fotos.
  const photoHtml = restaurant.photoName
    ? `<img data-photo="${escapeHtml(restaurant.photoName)}" alt="" width="80" height="80">`
    : "";
  const priceDisplay = matchedFood?.price
    ? formatCurrency(matchedFood.price)
    : (restaurant.priceLevel ?? "Ver en Maps");

  return `
    <article class="restaurant-card ${isSelected ? "is-selected" : ""}">
      <div>
        <div class="card__title">
          <h3>${escapeHtml(restaurant.name)}</h3>
          <span class="status">Google Places</span>
        </div>
        <div class="card__meta">
          <span>${escapeHtml(restaurant.area)}</span>
          <span>A ${(restaurant.distanceKm || 0).toFixed(1)} km</span>
          ${ratingHtml}
          ${priceLevelHtml}
          ${openNowHtml}
          <span>${escapeHtml(restaurant.sourceLabel)}</span>
        </div>
        <p class="dish-line">${escapeHtml(matchedFood?.name || "Comida cercana")}</p>
      </div>
      <div class="price-box">
        ${photoHtml}
        <span class="price">${escapeHtml(priceDisplay)}</span>
        <span class="booking">Ver en Maps</span>
      </div>
      <div class="card__actions">
        <button type="button" data-select="${escapeHtml(restaurant.id)}">Ver en mapa</button>
        <button type="button" data-detail="${escapeHtml(restaurant.id)}">Detalles</button>
        <button class="favorite-button ${isFavorite(restaurant.id) ? "is-saved" : ""}" type="button" data-favorite="${escapeHtml(restaurant.id)}">${favoriteLabel}</button>
        <a href="${buildMapsUrl(restaurant)}" target="${target}" rel="noreferrer">Google Maps</a>
        <a href="${buildMapsUrl(restaurant, "directions")}" target="${target}" rel="noreferrer">Ruta</a>
      </div>
    </article>
  `;
}

function renderSelectedRestaurant(restaurant: Restaurant, results: Restaurant[]): void {
  const query = encodeURIComponent(`${restaurant.name}, ${restaurant.area}`);
  dom.mapFrame.src = `https://www.google.com/maps?q=${query}&output=embed`;
  dom.selectedSummary.innerHTML = `
    <h3>${escapeHtml(restaurant.name)}</h3>
    <p>Resultado real de Google Places a ${(restaurant.distanceKm || 0).toFixed(1)} km. Abre Google Maps para ver horarios, reservas, fotos, reseñas y ruta.</p>
  `;
  dom.mapPlaceList.innerHTML = results
    .slice(0, 6)
    .map((item, index) => {
      return `<button type="button" data-select="${escapeHtml(item.id)}">${index + 1}. ${escapeHtml(item.name)}<span>A ${(item.distanceKm || 0).toFixed(1)} km</span></button>`;
    })
    .join("");
}

function renderNoResults(): void {
  const mapsQuery = encodeURIComponent(`${dom.dishInput.value || "restaurante"} cerca de ${state.currentLocation.label}`);
  dom.resultsList.innerHTML = `
    <div class="empty-state">
      <h3>No se encontraron resultados en Google Places</h3>
      <p>Prueba con otra comida o continúa directamente en Google Maps.</p>
      <a href="https://www.google.com/maps/search/${mapsQuery}" target="_blank" rel="noreferrer">Abrir Google Maps</a>
    </div>
  `;
  dom.resultCount.textContent = "0 lugares";
  dom.mapFrame.src = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  dom.selectedSummary.innerHTML = "<p>No hay ningún restaurante seleccionado.</p>";
  dom.mapPlaceList.innerHTML = "";
}

export function renderLocationSuggestions(places: GeocodingPlace[], getShortName: (place: GeocodingPlace) => string): void {
  dom.locationSuggestions.innerHTML = "";

  if (!places.length) {
    const emptyItem = document.createElement("button");
    emptyItem.type = "button";
    emptyItem.disabled = true;
    emptyItem.textContent = "No se encontraron ubicaciones";
    dom.locationSuggestions.append(emptyItem);
    dom.locationSuggestions.hidden = false;
    return;
  }

  places.forEach((place, index) => {
    const option = document.createElement("button");
    const primary = document.createElement("strong");
    const secondary = document.createElement("span");

    option.type = "button";
    option.dataset.locationIndex = String(index);
    primary.textContent = getShortName(place);
    secondary.textContent = place.display_name;
    option.append(primary, secondary);
    dom.locationSuggestions.append(option);
  });

  dom.locationSuggestions.hidden = false;
}

export function hideLocationSuggestions(): void {
  dom.locationSuggestions.hidden = true;
  dom.locationSuggestions.innerHTML = "";
}

function applyBudgetToPriceFilter(): void {
  const priceByBudget: Record<string, string> = {
    any: "all",
    cheap: "10",
    medium: "15",
    premium: "20",
  };
  dom.priceFilter.value = priceByBudget[state.settings.budgetLevel] || "all";
}

function renderConnectionStatus(): void {
  const hasProviderError = Boolean(state.providerErrorMessage);
  const statusText = hasProviderError
    ? "Google Places necesita configuración"
    : state.activeRestaurants.length
      ? "Google Places conectado"
      : "Esperando búsqueda";
  const detailText = hasProviderError
    ? state.providerErrorMessage
    : state.activeRestaurants.length
      ? `${state.activeRestaurants.length} restaurantes reales cargados.`
      : "Haz una búsqueda para comprobar la conexión con Google Places.";

  dom.connectionStatus.innerHTML = `
    <strong>${escapeHtml(statusText)}</strong>
    <span>${escapeHtml(detailText)}</span>
  `;
  dom.connectionStatus.classList.toggle("is-warning", hasProviderError);
  dom.connectionStatus.classList.toggle("is-ok", !hasProviderError && state.activeRestaurants.length > 0);
}

function renderDeveloperPanel(): void {
  dom.debugVersion.textContent = appConfig.appVersion;
  dom.debugEndpoint.textContent = appConfig.api.placesSearchPath;
  dom.debugRadius.textContent = state.settings.defaultRadiusKm === "all" ? "Sin límite" : `${state.settings.defaultRadiusKm} km`;
  dom.debugResults.textContent = String(state.activeRestaurants.length);
  dom.debugProvider.textContent = state.providerErrorMessage || "Sin errores activos";
}

export function renderFavorites(): void {
  const panel = document.querySelector("#favorites-panel");
  if (!panel) return;

  const target = state.settings.openMapsInNewTab ? "_blank" : "_self";
  const filteredFavorites = getVisibleFavorites();
  const favoriteLists = getFavoriteLists();
  const content = state.favorites.length ? renderFavoriteCollection(filteredFavorites, favoriteLists, target) : renderFavoritesEmptyState();

  panel.innerHTML = `
    <div class="section-heading">
      <h2 id="favorites-title">Favoritos <span id="favorites-count">(${state.favorites.length})</span></h2>
    </div>
    ${content}
  `;
}

function renderFavoriteCollection(favorites: FavoriteRestaurant[], favoriteLists: string[], target: string): string {
  const listOptions = ["all", ...favoriteLists]
    .map((listName) => {
      const label = listName === "all" ? "Todas las listas" : listName;
      return `<option value="${escapeHtml(listName)}" ${state.settings.favoriteListFilter === listName ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");

  return `
    <div class="favorites-toolbar">
      <label>
        <span>Lista</span>
        <select data-favorite-list-filter>
          ${listOptions}
        </select>
      </label>
      <label>
        <span>Ordenar</span>
        <select data-favorite-sort>
          <option value="recent" ${state.settings.favoriteSortMode === "recent" ? "selected" : ""}>Recientes</option>
          <option value="distance" ${state.settings.favoriteSortMode === "distance" ? "selected" : ""}>Distancia</option>
          <option value="name" ${state.settings.favoriteSortMode === "name" ? "selected" : ""}>Nombre</option>
          <option value="list" ${state.settings.favoriteSortMode === "list" ? "selected" : ""}>Lista</option>
        </select>
      </label>
      <label class="setting-row compact-setting">
        <span>Solo cerca</span>
        <input data-favorite-near-only type="checkbox" ${state.settings.favoriteNearOnly ? "checked" : ""} />
      </label>
    </div>
    <div class="sync-panel">
      <strong>Sincronización preparada</strong>
      <span>La estructura ya admite listas, notas y etiquetas para llevar favoritos a una cuenta cuando añadamos login.</span>
      <button type="button" data-export-favorites>Exportar backup</button>
    </div>
    <div class="compare-panel">
      <span>Selecciona 2 o 3 favoritos para comparar distancia, lista, etiquetas y acciones.</span>
      <button type="button" data-compare-favorites>Comparar</button>
    </div>
    <div class="results-list">
      ${favorites.length ? favorites.map((favorite) => renderFavoriteCard(favorite, favoriteLists, target)).join("") : renderFavoritesFilteredEmptyState()}
    </div>
  `;
}

function renderFavoriteCard(favorite: FavoriteRestaurant, favoriteLists: string[], target: string): string {
  const mapsUrl = buildFavoriteMapsUrl(favorite);
  const routeUrl = buildFavoriteMapsUrl(favorite, "directions");
  const restaurant = state.activeRestaurants.find((item) => item.id === favorite.id);
  const distanceLabel = restaurant ? `A ${getDistanceKm(state.currentLocation, restaurant).toFixed(1)} km` : "Distancia al buscar";
  const note = favorite.note || "";
  const tags = favorite.tags || [];
  const listName = favorite.list || "Pendientes";
  const listOptions = getEditableFavoriteLists(favoriteLists)
    .map((option) => `<option value="${escapeHtml(option)}" ${listName === option ? "selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");

  return `
    <article class="restaurant-card favorite-card">
      <label class="compare-check">
        <input type="checkbox" data-compare-favorite="${escapeHtml(favorite.id)}" />
        <span>Comparar</span>
      </label>
      <div>
        <div class="card__title">
          <h3>${escapeHtml(favorite.name)}</h3>
          <span class="status">${escapeHtml(listName)}</span>
        </div>
        <div class="card__meta">
          <span>${escapeHtml(favorite.area)}</span>
          <span>${escapeHtml(distanceLabel)}</span>
          <span>Apertura: ver en Maps</span>
        </div>
        <div class="favorite-tags">${renderFavoriteTags(tags)}</div>
      </div>
      <div class="favorite-editor">
        <label>
          <span>Lista</span>
          <select data-favorite-list="${escapeHtml(favorite.id)}">${listOptions}</select>
        </label>
        <label>
          <span>Nota personal</span>
          <textarea data-favorite-note="${escapeHtml(favorite.id)}" rows="2" placeholder="Ej. probar la burger doble">${escapeHtml(note)}</textarea>
        </label>
        <label>
          <span>Etiquetas</span>
          <input data-favorite-tags="${escapeHtml(favorite.id)}" value="${escapeHtml(tags.join(", "))}" placeholder="barato, terraza, vegano" />
        </label>
      </div>
      <div class="card__actions">
        <a href="${mapsUrl}" target="${target}" rel="noreferrer">Maps</a>
        <a href="${routeUrl}" target="${target}" rel="noreferrer">Ruta</a>
        <button type="button" data-share-favorite="${escapeHtml(favorite.id)}">Compartir</button>
        <button type="button" data-remove-favorite="${escapeHtml(favorite.id)}">Quitar</button>
      </div>
    </article>
  `;
}

function renderFavoriteTags(tags: string[]): string {
  if (!tags.length) return '<span class="muted-note">Sin etiquetas todavía.</span>';
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function renderFavoritesEmptyState(): string {
  return `
    <div class="empty-state favorite-empty">
      <h3>Aún no tienes favoritos</h3>
      <p>Guarda restaurantes desde los resultados para crear listas, notas y comparativas.</p>
      <div class="card__actions">
        <button type="button" data-dish="hamburguesas">Buscar hamburguesas</button>
        <button type="button" data-dish="sushi">Buscar sushi</button>
        <button type="button" data-nav-view="explore">Explorar categorías</button>
      </div>
    </div>
  `;
}

function renderFavoritesFilteredEmptyState(): string {
  return `
    <div class="empty-state">
      <h3>No hay favoritos con ese filtro</h3>
      <p>Cambia la lista, desactiva "Solo cerca" o guarda más restaurantes.</p>
    </div>
  `;
}

function getVisibleFavorites(): FavoriteRestaurant[] {
  const listFilter = state.settings.favoriteListFilter;
  return state.favorites
    .filter((favorite) => {
      if (listFilter !== "all" && (favorite.list || "Pendientes") !== listFilter) return false;
      if (!state.settings.favoriteNearOnly) return true;
      const restaurant = state.activeRestaurants.find((item) => item.id === favorite.id);
      return restaurant ? getDistanceKm(state.currentLocation, restaurant) <= 5 : false;
    })
    .sort(sortFavoriteRestaurants);
}

function sortFavoriteRestaurants(first: FavoriteRestaurant, second: FavoriteRestaurant): number {
  if (state.settings.favoriteSortMode === "name") return first.name.localeCompare(second.name);
  if (state.settings.favoriteSortMode === "list") return (first.list || "Pendientes").localeCompare(second.list || "Pendientes");
  if (state.settings.favoriteSortMode === "distance") {
    return getFavoriteDistance(first) - getFavoriteDistance(second);
  }
  return Date.parse(second.savedAt) - Date.parse(first.savedAt);
}

function getFavoriteDistance(favorite: FavoriteRestaurant): number {
  const restaurant = state.activeRestaurants.find((item) => item.id === favorite.id);
  return restaurant ? getDistanceKm(state.currentLocation, restaurant) : Number.POSITIVE_INFINITY;
}

function getFavoriteLists(): string[] {
  return Array.from(new Set(state.favorites.map((favorite) => favorite.list || "Pendientes"))).sort();
}

function getEditableFavoriteLists(favoriteLists: string[]): string[] {
  return Array.from(new Set(["Pendientes", "Cena", "Trabajo", "Cita", "Baratos", ...favoriteLists])).sort();
}

export function showRestaurantDetail(restaurant: Restaurant): void {
  const target = state.settings.openMapsInNewTab ? "_blank" : "_self";

  const photoHtml = restaurant.photoName
    ? `<img class="detail__photo" src="/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}" alt="" loading="lazy">`
    : "";

  const ratingHtml = restaurant.rating
    ? `<span>★ ${restaurant.rating.toFixed(1)}${restaurant.userRatingCount ? ` · ${formatCount(restaurant.userRatingCount)} reseñas` : ""}</span>`
    : "";
  const badgesHtml = [
    ratingHtml,
    restaurant.priceLevel ? `<span>${escapeHtml(restaurant.priceLevel)}</span>` : "",
    restaurant.openNow !== undefined ? `<span>${restaurant.openNow ? "Abierto ahora" : "Cerrado ahora"}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const phoneHtml = restaurant.phoneNumber
    ? `<p><a href="tel:${escapeHtml(restaurant.phoneNumber)}">${escapeHtml(restaurant.phoneNumber)}</a></p>`
    : "";
  const websiteHtml = restaurant.websiteUri
    ? `<p><a href="${escapeHtml(restaurant.websiteUri)}" target="_blank" rel="noreferrer noopener">Sitio web</a></p>`
    : "";

  dom.detailContent.innerHTML = `
    <h2>${escapeHtml(restaurant.name)}</h2>
    ${photoHtml}
    ${badgesHtml ? `<div class="detail__badges">${badgesHtml}</div>` : ""}
    <p>${escapeHtml(restaurant.area)}</p>
    ${phoneHtml}
    ${websiteHtml}
    <p>${escapeHtml(restaurant.sourceLabel)} · A ${getDistanceKm(state.currentLocation, restaurant).toFixed(1)} km</p>
    <div class="card__actions">
      <button type="button" data-favorite="${escapeHtml(restaurant.id)}">${isFavorite(restaurant.id) ? "Guardado" : "Guardar"}</button>
      <a href="${buildMapsUrl(restaurant)}" target="${target}" rel="noreferrer">Google Maps</a>
      <a href="${buildMapsUrl(restaurant, "directions")}" target="${target}" rel="noreferrer">Ruta</a>
    </div>
  `;
  dom.detailDialog.showModal();
}

function updateCurrentSearchMapsLink(): void {
  const query = encodeURIComponent(`${dom.dishInput.value || "restaurante"} cerca de ${state.currentLocation.label}`);
  dom.currentSearchMaps.href = `https://www.google.com/maps/search/${query}`;
}
