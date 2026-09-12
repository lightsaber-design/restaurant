import { state } from "./state/store";
import type { FoodMatch, Restaurant } from "./types";
import { normalizeText } from "./utils/format";
import { getDistanceKm } from "./utils/geo";

export function findFoodMatch(restaurant: Restaurant, query: string): FoodMatch | undefined {
  const normalizedQuery = normalizeText(query);
  return restaurant.foods.find((food) => {
    const searchableTerms = [food.dish, food.name, ...food.aliases].map(normalizeText);
    return searchableTerms.some((term) => isSmartMatch(term, normalizedQuery));
  });
}

export function getFilteredResults(queryValue: string, maxDistanceKm?: number): Restaurant[] {
  const query = normalizeText(queryValue);
  const { maxPrice: maxPriceSetting, defaultRadiusKm, openNow } = state.settings;
  const maxPrice = maxPriceSetting === "all" ? Infinity : Number(maxPriceSetting);
  const maxDistance = maxDistanceKm != null
    ? maxDistanceKm
    : defaultRadiusKm === "all" ? Infinity : Number(defaultRadiusKm);
  const favoriteIds = new Set(state.favorites.map((item) => item.id));

  return state.activeRestaurants
    .map((restaurant) => {
      const distanceKm = getDistanceKm(state.currentLocation, restaurant);
      if (distanceKm > maxDistance) return null;
      if (openNow && restaurant.openNow === false) return null;

      // Sin texto de búsqueda: incluir todos los restaurantes sin filtrar por comida
      if (!query) {
        return { ...restaurant, distanceKm, matchedFood: restaurant.foods[0] };
      }

      const food = findFoodMatch(restaurant, query);
      if (!food) return null;
      if (food.price !== null && food.price > maxPrice) return null;

      return { ...restaurant, distanceKm, matchedFood: food };
    })
    .filter((restaurant): restaurant is Restaurant & { distanceKm: number; matchedFood: FoodMatch } => Boolean(restaurant))
    .sort((first, second) => {
      if (state.settings.sortMode === "nearest") return first.distanceKm - second.distanceKm;

      const firstFav = favoriteIds.has(first.id) ? -1 : 0;
      const secondFav = favoriteIds.has(second.id) ? -1 : 0;
      if (state.settings.sortMode === "favorites") return firstFav - secondFav || first.distanceKm - second.distanceKm;

      const firstPrice = first.matchedFood.price ?? 999;
      const secondPrice = second.matchedFood.price ?? 999;
      return firstFav - secondFav || firstPrice - secondPrice || first.distanceKm - second.distanceKm;
    });
}

function isSmartMatch(term: string, query: string): boolean {
  if (!query) return true;
  if (term.includes(query) || query.includes(term)) return true;
  return term.split(" ").some((word) => word.length > 5 && getEditDistance(word, query) <= 2);
}

function getEditDistance(firstValue: string, secondValue: string): number {
  const m = firstValue.length;
  const n = secondValue.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = firstValue[i - 1] === secondValue[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}
