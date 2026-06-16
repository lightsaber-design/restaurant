// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebView: any = null;
try { WebView = require("react-native-webview").WebView; } catch {}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RestaurantCard from "../components/RestaurantCard";
import { useAppState } from "../hooks/useAppState";
import { fetchNearbyRestaurants, getProviderErrorMessage } from "../providers/placesProvider";
import {
  addRecentSearch,
  addSmartHistory,
  clearPendingSearch,
  setProviderError,
  setRestaurants,
  setSelectedRestaurant,
  setView,
  updateSettings,
} from "../state/store";
import { getFilteredResults } from "../selectors";
import { CATEGORIES, MORE_CATEGORIES, theme } from "../theme";
import { normalizeText } from "../utils/format";
import { AntojoLogo } from "../components/AntojoLogo";
import type { Restaurant } from "../types";

function buildLeafletHtml(
  center: { latitude: number; longitude: number },
  places: Restaurant[],
  selectedId: string | null,
  accent = "#16A34A",
): string {
  const markers = places.map((p) => ({
    id: p.id,
    lat: p.latitude,
    lng: p.longitude,
    name: p.name.replace(/'/g, "\\'").replace(/"/g, "&quot;"),
    selected: p.id === selectedId,
  }));
  return `<!doctype html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#EBF1E6;}
  .leaflet-popup-content{font-family:sans-serif;font-weight:700;}
  .pin{display:flex;align-items:center;justify-content:center;height:28px;min-width:44px;padding:0 9px;border-radius:99px;background:#fff;color:#15241B;border:2px solid ${accent};font-weight:800;font-size:12.5px;box-shadow:0 3px 10px rgba(0,0,0,.2);white-space:nowrap;cursor:pointer;}
  .pin-sel{background:${accent};color:#fff;transform:scale(1.1);}
  .pin-wrap{background:none!important;border:none!important;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center=[${center.latitude},${center.longitude}];
  var map=L.map('map',{zoomControl:false,attributionControl:false}).setView(center, ${places.length ? 14 : 12});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);
  var markers=${JSON.stringify(markers)};
  markers.forEach(function(m){
    var icon=L.divIcon({
      html:'<div class="pin'+(m.selected?' pin-sel':'')+'">📍</div>',
      className:'pin-wrap', iconSize:[44,30], iconAnchor:[22,30]
    });
    var mk=L.marker([m.lat,m.lng],{icon:icon}).addTo(map);
    mk.on('click',function(){
      if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m.id);}
    });
  });
</script>
</body></html>`;
}

// ── Quick filter chips ────────────────────────────────────────────────────────

function QuickFilterBar({ activeFilters, onToggle }: { activeFilters: Set<string>; onToggle: (k: string) => void }) {
  const appState = useAppState();
  const s = appState.settings;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.qfScroll}
      contentContainerStyle={styles.qfRow}
    >
      {/* Open now */}
      <TouchableOpacity
        style={[styles.qfChip, s.openNow && styles.qfChipOn]}
        onPress={() => updateSettings({ openNow: !s.openNow })}
      >
        <Text style={[styles.qfText, s.openNow && styles.qfTextOn]}>
          🕐 {s.openNow ? "Abiertos" : "Abierto ahora"}
        </Text>
      </TouchableOpacity>

      {/* Rating */}
      <TouchableOpacity
        style={[styles.qfChip, activeFilters.has("top") && styles.qfChipOn]}
        onPress={() => onToggle("top")}
      >
        <Text style={[styles.qfText, activeFilters.has("top") && styles.qfTextOn]}>4.5+ ⭐</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const [dishText, setDishText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const search = useCallback(
    async (query: string) => {
      const { latitude, longitude } = appState.currentLocation;
      setLoading(true);
      try {
        const restaurants = await fetchNearbyRestaurants(query, latitude, longitude, appState.settings.defaultRadiusKm);
        setRestaurants(restaurants);
      } catch (error) {
        setProviderError(getProviderErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [appState.currentLocation, appState.settings.defaultRadiusKm],
  );

  function searchDish(dish: string) {
    const q = dish === "all" ? "" : dish.trim();
    setDishText(q);
    setSuggestOpen(false);
    setSelectedRestaurant(null);
    if (q) { addRecentSearch(q); addSmartHistory(q); }
    void search(q);
  }

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (!appState.pendingSearch) return;
    const q = appState.pendingSearch;
    clearPendingSearch();
    setDishText(q);
    setSuggestOpen(false);
    addRecentSearch(q);
    addSmartHistory(q);
    void search(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.pendingSearch]);

  const suggestions = useMemo(() => {
    if (dishText.length < 3) return null;
    const q = normalizeText(dishText);
    const saved = appState.savedCategories.filter((c) => normalizeText(c).includes(q));
    const unsaved = [...CATEGORIES.filter((c) => c.dish !== "all"), ...MORE_CATEGORIES.map((d) => ({ dish: d, emoji: null, label: d }))]
      .filter((c) => normalizeText(c.label ?? c.dish).includes(q) && !appState.savedCategories.includes(c.dish));
    return { saved, unsaved };
  }, [dishText, appState.savedCategories]);

  let results = getFilteredResults(dishText);
  if (activeFilters.has("top")) results = results.filter((r) => (r.rating ?? 0) >= 4.5);

  const hasError = appState.providerErrorMessage !== "";
  const hasSearched = appState.activeRestaurants.length > 0 || hasError || loading;
  const showSuggestions = suggestOpen && suggestions !== null;

  const mapResults = getFilteredResults("");
  const mapSelected = mapResults.find((r) => r.id === appState.selectedRestaurantId) || mapResults[0] || null;
  const mapKey = `${appState.currentLocation.latitude},${appState.currentLocation.longitude}|${mapResults.map((r) => r.id).join(",")}|${mapSelected?.id ?? ""}`;
  const mapHtml = useMemo(
    () => buildLeafletHtml(appState.currentLocation, mapResults, mapSelected?.id ?? null, theme.accent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapKey],
  );

  return (
    <View style={styles.screen}>
      {/* ── Sticky top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Brand row */}
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <AntojoLogo size={26} c="#FFFFFF" bg={theme.accent} bite="#FF6B4A" />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Antojo</Text>
            <TouchableOpacity onPress={() => setView("profile")} style={styles.locationBtn}>
              <Text style={styles.locationPin}>📍</Text>
              <Text style={styles.locationLabel} numberOfLines={1}>{appState.currentLocation.label}</Text>
              <Text style={styles.locationChevron}>›</Text>
            </TouchableOpacity>
          </View>
          {/* List / Map toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, !mapMode && styles.toggleBtnActive]}
              onPress={() => setMapMode(false)}
            >
              <Text style={[styles.toggleBtnText, !mapMode && styles.toggleBtnTextActive]}>≡ Lista</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mapMode && styles.toggleBtnActive]}
              onPress={() => setMapMode(true)}
            >
              <Text style={[styles.toggleBtnText, mapMode && styles.toggleBtnTextActive]}>⊞ Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Busca tu antojo (ej. hamburguesas)"
              placeholderTextColor={theme.muted2}
              value={dishText}
              onChangeText={(v) => {
                setDishText(v);
                setSuggestOpen(v.length >= 3);
              }}
              onSubmitEditing={() => searchDish(dishText)}
              returnKeyType="search"
            />
            {dishText.length > 0 && (
              <TouchableOpacity onPress={() => { setDishText(""); setSuggestOpen(false); }} hitSlop={10}>
                <Text style={styles.clearBtn}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </View>

      {/* ── Content ── */}
      {showSuggestions ? (
        <ScrollView
          style={styles.suggestScroll}
          contentContainerStyle={styles.suggestContent}
          keyboardShouldPersistTaps="always"
        >
          {suggestions!.saved.length > 0 && (
            <>
              <Text style={styles.suggestSection}>Mis categorías</Text>
              {suggestions!.saved.map((cat) => (
                <TouchableOpacity key={cat} style={styles.suggestRow} onPress={() => searchDish(cat)}>
                  <Text style={styles.suggestStar}>★</Text>
                  <Text style={styles.suggestLabel}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {suggestions!.unsaved.length > 0 && (
            <>
              <Text style={styles.suggestSection}>Categorías</Text>
              {suggestions!.unsaved.map((cat) => (
                <TouchableOpacity key={cat.dish} style={styles.suggestRow} onPress={() => searchDish(cat.dish)}>
                  <Text style={styles.suggestLabel}>{(cat.label ?? cat.dish).charAt(0).toUpperCase() + (cat.label ?? cat.dish).slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.suggestRaw} onPress={() => searchDish(dishText)}>
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.suggestRawText}>Buscar "{dishText}"</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : mapMode ? (
        /* ── Vista Mapa ── */
        <View style={{ flex: 1 }}>
          <QuickFilterBar activeFilters={activeFilters} onToggle={toggleFilter} />
          <View style={{ flex: 1, position: "relative" }}>
            {WebView ? (
              <WebView
                source={{ html: mapHtml }}
                style={{ flex: 1, backgroundColor: theme.panel2 }}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                onMessage={(e: { nativeEvent: { data: string } }) => setSelectedRestaurant(e.nativeEvent.data)}
              />
            ) : (
              <View style={styles.mapFallback}>
                <Text style={styles.mapFallbackIcon}>🗺</Text>
                <Text style={styles.mapFallbackText}>Mapa no disponible en este build</Text>
              </View>
            )}
          </View>
          {/* bottom carousel */}
          {mapResults.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mapCarousel}
              contentContainerStyle={styles.mapCarouselContent}
            >
              {mapResults.slice(0, 8).map((r) => {
                const active = r.id === mapSelected?.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.mapCard, active && styles.mapCardActive]}
                    onPress={() => setSelectedRestaurant(r.id)}
                  >
                    <Text style={styles.mapCardName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.mapCardMeta}>{(r.distanceKm ?? 0).toFixed(1)} km · {r.area}</Text>
                    {r.rating !== undefined && (
                      <Text style={styles.mapCardRating}>★ {r.rating.toFixed(1)}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : (
        /* ── Vista Lista ── */
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <QuickFilterBar activeFilters={activeFilters} onToggle={toggleFilter} />

          {/* Results header */}
          {hasSearched && !loading && (
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>Cerca de ti</Text>
                <Text style={styles.resultsCount}>
                  {results.length} {results.length === 1 ? "lugar" : "lugares"} en {appState.currentLocation.label}
                </Text>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={styles.loadingText}>Buscando restaurantes…</Text>
            </View>
          ) : hasError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔌</Text>
              <Text style={styles.emptyTitle}>Sin conexión a Places</Text>
              <Text style={styles.emptyText}>{appState.providerErrorMessage}</Text>
            </View>
          ) : results.length === 0 && appState.activeRestaurants.length > 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyTitle}>Sin coincidencias</Text>
              <Text style={styles.emptyText}>Prueba con otra categoría o quita algún filtro.</Text>
            </View>
          ) : appState.activeRestaurants.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Empieza una búsqueda</Text>
              <Text style={styles.emptyText}>Elige una categoría o escribe tu antojo arriba.</Text>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {results.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg, flex: 1 },

  // Top bar
  topBar: {
    backgroundColor: theme.bgTop,
    borderBottomColor: theme.line,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  brandLogo: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center",
    shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 4,
  },
  brandLogoIcon: { fontSize: 20 },
  brandText: { flex: 1, minWidth: 0 },
  brandTitle: { fontSize: 19, fontWeight: "800", color: theme.text, letterSpacing: -0.6 },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  locationPin: { fontSize: 11, color: theme.accent },
  locationLabel: { fontSize: 13, fontWeight: "700", color: theme.muted, maxWidth: 140 },
  locationChevron: { fontSize: 14, color: theme.muted2, fontWeight: "700" },
  viewToggle: {
    flexDirection: "row", gap: 4,
    backgroundColor: theme.panel2, borderRadius: 99, padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 11, height: 32, borderRadius: 99,
    alignItems: "center", justifyContent: "center",
  },
  toggleBtnActive: { backgroundColor: theme.panel },
  toggleBtnText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
  toggleBtnTextActive: { color: theme.accent, fontWeight: "800" },

  // Search
  searchWrap: { paddingHorizontal: 18, paddingBottom: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 50, paddingHorizontal: 16,
    backgroundColor: theme.searchBg, borderRadius: 16,
    borderWidth: 1, borderColor: theme.line,
    shadowColor: "#14281a", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  searchIcon: { color: theme.muted, fontSize: 20 },
  searchInput: { color: theme.text, flex: 1, fontSize: 15, fontWeight: "600" },
  clearBtn: { color: theme.muted2, fontSize: 22, fontWeight: "700", paddingHorizontal: 4 },

  // Quick filter bar
  qfScroll: {},
  qfRow: { paddingHorizontal: 18, paddingVertical: 2, paddingBottom: 14, gap: 8, flexDirection: "row", alignItems: "center" },
  qfChip: {
    height: 36, paddingHorizontal: 14, borderRadius: 99,
    backgroundColor: theme.chip, borderWidth: 1.5, borderColor: theme.line,
    alignItems: "center", justifyContent: "center",
  },
  qfChipOn: { backgroundColor: theme.accentSoft, borderColor: "rgba(22,163,74,0.4)" },
  qfText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  qfTextOn: { color: theme.accent },

  // Content
  content: { paddingBottom: 120, paddingHorizontal: 18, paddingTop: 4 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  resultsTitle: { fontSize: 22, fontWeight: "800", color: theme.text, letterSpacing: -0.5 },
  resultsCount: { fontSize: 13, color: theme.muted, fontWeight: "600", marginTop: 2 },
  resultsList: { gap: 16 },

  // Empty / loading
  loadingBox: { alignItems: "center", paddingVertical: 60 },
  loadingText: { color: theme.muted, fontSize: 14, marginTop: 12 },
  emptyState: {
    alignItems: "center", paddingVertical: 56, paddingHorizontal: 24,
    backgroundColor: theme.panel, borderRadius: 24,
    borderWidth: 1, borderColor: theme.line, marginTop: 16,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyText: { color: theme.muted, fontSize: 13.5, lineHeight: 21, marginTop: 4, textAlign: "center" },

  // Suggestions
  suggestScroll: { flex: 1, backgroundColor: theme.bg },
  suggestContent: { paddingBottom: 80 },
  suggestSection: {
    color: theme.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4, textTransform: "uppercase",
  },
  suggestRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.line,
  },
  suggestStar: { color: theme.accent, fontSize: 16 },
  suggestLabel: { color: theme.text, flex: 1, fontSize: 15, fontWeight: "700" },
  suggestRaw: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginTop: 4, paddingHorizontal: 18, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.line,
  },
  suggestRawText: { color: theme.muted, fontSize: 15, fontStyle: "italic" },

  // Map
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  mapFallbackIcon: { fontSize: 48, marginBottom: 12 },
  mapFallbackText: { color: theme.accent, fontSize: 16, fontWeight: "900" },
  mapCarousel: { maxHeight: 130, backgroundColor: "transparent" },
  mapCarouselContent: { paddingHorizontal: 18, paddingVertical: 10, gap: 12, flexDirection: "row" },
  mapCard: {
    width: 200, backgroundColor: theme.panel, borderRadius: 16,
    padding: 12, borderWidth: 1.5, borderColor: theme.line,
    shadowColor: "#14281a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  mapCardActive: { borderColor: theme.accent },
  mapCardName: { color: theme.text, fontSize: 15.5, fontWeight: "800" },
  mapCardMeta: { color: theme.muted, fontSize: 12.5, fontWeight: "600", marginTop: 2 },
  mapCardRating: { color: theme.star, fontSize: 12.5, fontWeight: "700", marginTop: 6 },
});
