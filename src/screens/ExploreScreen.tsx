import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RestaurantDetailModal from "../components/RestaurantDetailModal";
import { PlaceCard, TrendingCard } from "../components/PlaceCard";
import { useAppState } from "../hooks/useAppState";
import { fetchNearbyRestaurants, getProviderErrorMessage } from "../providers/placesProvider";
import {
  setProviderError,
  setRestaurants,
  setView,
  toggleFavorite,
  triggerSearch,
} from "../state/store";
import { getFilteredResults } from "../selectors";
import { CATEGORIES, theme } from "../theme";
import { AntojoLogo } from "../components/AntojoLogo";
import { Icon } from "../components/Icon";
import type { Restaurant } from "../types";

export default function ExploreScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);

  // Carga inicial: trae variedad para poblar "Tendencias" y "Cerca de ti".
  const loadDefault = useCallback(async () => {
    const { latitude, longitude } = appState.currentLocation;
    setLoading(true);
    try {
      const restaurants = await fetchNearbyRestaurants("restaurantes", latitude, longitude, appState.settings.defaultRadiusKm);
      setRestaurants(restaurants);
    } catch (error) {
      setProviderError(getProviderErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [appState.currentLocation, appState.settings.defaultRadiusKm]);

  useEffect(() => {
    if (appState.activeRestaurants.length === 0 && appState.providerErrorMessage === "") {
      void loadDefault();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = getFilteredResults("");
  const hasError = appState.providerErrorMessage !== "";

  // Tendencias (carrusel) + resto (tarjetas)
  const showCarousel = results.length >= 4;
  const trending = showCarousel ? results.slice(0, 5) : [];
  const listItems = showCarousel ? results.slice(5) : results;

  return (
    <View style={styles.screen}>
      {/* ── Sticky top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <AntojoLogo size={28} c="#FFFFFF" bg={theme.accent} bite={theme.secondary} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Antojo</Text>
            <TouchableOpacity onPress={() => setView("profile")} style={styles.locationBtn}>
              <Icon name="place" size={13} color={theme.accent} />
              <Text style={styles.locationLabel} numberOfLines={1}>{appState.currentLocation.label}</Text>
              <Icon name="expand-more" size={15} color={theme.muted2} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>¿Qué se te antoja hoy?</Text>

        {/* Circular category carousel → dispara búsqueda en Buscar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.dish}
              style={styles.catItem}
              onPress={() => triggerSearch(cat.dish)}
              activeOpacity={0.75}
            >
              <View style={styles.catCircle}>
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
              </View>
              <Text style={styles.catLabel} numberOfLines={1}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Cargando tu zona…</Text>
          </View>
        ) : hasError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔌</Text>
            <Text style={styles.emptyTitle}>Sin conexión a Places</Text>
            <Text style={styles.emptyText}>{appState.providerErrorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void loadDefault()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : results.length > 0 ? (
          <>
            {showCarousel && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tendencias en tu zona</Text>
                  <TouchableOpacity onPress={() => setView("search")}>
                    <Text style={styles.seeAll}>Ver todo</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.trendScroll}
                  contentContainerStyle={styles.trendContent}
                >
                  {trending.map((r) => (
                    <TrendingCard key={r.id} restaurant={r} onPress={() => setDetailRestaurant(r)} />
                  ))}
                </ScrollView>
              </>
            )}

            {listItems.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: showCarousel ? 22 : 4 }]}>
                  <Text style={styles.sectionTitle}>Cerca de ti</Text>
                  <Text style={styles.sectionCount}>{listItems.length} {listItems.length === 1 ? "lugar" : "lugares"}</Text>
                </View>
                {listItems.map((r) => (
                  <PlaceCard
                    key={r.id}
                    restaurant={r}
                    onPress={() => setDetailRestaurant(r)}
                    isFav={appState.favorites.some((f) => f.id === r.id)}
                    onToggleFav={() => toggleFavorite(r.id)}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Nada por aquí todavía</Text>
            <Text style={styles.emptyText}>Toca una categoría o busca tu antojo arriba.</Text>
          </View>
        )}
      </ScrollView>

      {detailRestaurant && (
        <RestaurantDetailModal restaurant={detailRestaurant} onClose={() => setDetailRestaurant(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg, flex: 1 },

  // Top bar
  topBar: { backgroundColor: theme.bgTop, borderBottomColor: theme.line, borderBottomWidth: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  brandLogo: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: theme.accent, alignItems: "center", justifyContent: "center",
    shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 4,
  },
  brandText: { flex: 1, minWidth: 0 },
  brandTitle: { fontSize: 19, fontWeight: "800", color: theme.accent, letterSpacing: -0.6 },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  locationLabel: { fontSize: 13, fontWeight: "700", color: theme.muted, maxWidth: 180 },

  // Search
  searchWrap: { paddingHorizontal: 18, paddingBottom: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 50, paddingHorizontal: 16,
    backgroundColor: theme.searchBg, borderRadius: 16, borderWidth: 1, borderColor: theme.line,
    shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  searchPlaceholder: { color: theme.muted2, flex: 1, fontSize: 15, fontWeight: "600" },
  slidersBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft },

  // Hero
  hero: { fontSize: 26, fontWeight: "800", color: theme.text, letterSpacing: -0.6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 2 },

  // Circular categories
  catScroll: { marginBottom: 4 },
  catContent: { paddingHorizontal: 18, paddingVertical: 14, gap: 18 },
  catItem: { alignItems: "center", width: 64 },
  catCircle: {
    width: 60, height: 60, borderRadius: 99,
    backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center",
    marginBottom: 7,
  },
  catEmoji: { fontSize: 26 },
  catLabel: { fontSize: 11.5, fontWeight: "700", color: theme.muted, textAlign: "center" },

  // Content
  content: { paddingBottom: 120, paddingHorizontal: 18, paddingTop: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 12, paddingTop: 4 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: theme.text, letterSpacing: -0.4 },
  sectionCount: { fontSize: 13, color: theme.muted, fontWeight: "600" },
  seeAll: { fontSize: 13.5, fontWeight: "800", color: theme.accent },

  // Trending carousel
  trendScroll: { marginHorizontal: -18 },
  trendContent: { paddingHorizontal: 18, gap: 14, paddingBottom: 4 },

  // Empty / loading
  loadingBox: { alignItems: "center", paddingVertical: 60 },
  loadingText: { color: theme.muted, fontSize: 14, marginTop: 12 },
  emptyState: {
    alignItems: "center", paddingVertical: 56, paddingHorizontal: 24,
    backgroundColor: theme.panel, borderRadius: 24, borderWidth: 1, borderColor: theme.line, marginTop: 16,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyText: { color: theme.muted, fontSize: 13.5, lineHeight: 21, marginTop: 4, textAlign: "center" },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, height: 44, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  retryText: { color: theme.onAccent, fontSize: 14, fontWeight: "800" },
});
