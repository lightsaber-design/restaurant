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
import type { Restaurant } from "../types";

const PRICE_CYCLE: Array<{ label: string; value: "all" | "10" | "15" | "20" }> = [
  { label: "Cualquier precio", value: "all" },
  { label: "< €10", value: "10" },
  { label: "< €15", value: "15" },
  { label: "< €20", value: "20" },
];
const DISTANCE_CYCLE: Array<{ label: string; value: "all" | "1" | "3" | "5" }> = [
  { label: "Cualquier distancia", value: "all" },
  { label: "1 km", value: "1" },
  { label: "3 km", value: "3" },
  { label: "5 km", value: "5" },
];
const SORT_CYCLE: Array<{ label: string; value: "best" | "nearest" | "favorites" }> = [
  { label: "Mejor resultado", value: "best" },
  { label: "Más cercanos", value: "nearest" },
  { label: "Favoritos primero", value: "favorites" },
];

const ALL_CAT_DISHES = [...CATEGORIES.map((c) => c.dish), ...MORE_CATEGORIES];

function buildLeafletHtml(
  center: { latitude: number; longitude: number },
  places: Restaurant[],
  selectedId: string | null,
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
  html,body,#map{height:100%;margin:0;background:#191a21;}
  .leaflet-popup-content{font-family:sans-serif;font-weight:700;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center=[${center.latitude},${center.longitude}];
  var map=L.map('map',{zoomControl:true}).setView(center, ${places.length ? 14 : 12});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'© OpenStreetMap'
  }).addTo(map);
  var markers=${JSON.stringify(markers)};
  var group=[];
  markers.forEach(function(m){
    var icon=L.divIcon({
      html:'<div style="background:'+(m.selected?'#a985ff':'#7f5af0')+';width:'+(m.selected?22:16)+'px;height:'+(m.selected?22:16)+'px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5);"></div>',
      className:'', iconSize:[22,22], iconAnchor:[11,11]
    });
    var mk=L.marker([m.lat,m.lng],{icon:icon}).addTo(map);
    mk.bindPopup('<b>'+m.name+'</b>');
    mk.on('click',function(){
      if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m.id);}
    });
    group.push([m.lat,m.lng]);
  });
  if(group.length>1){ map.fitBounds(group,{padding:[40,40]}); }
</script>
</body></html>`;
}

// ── Barra de filtros rápidos ─────────────────────────────────────────────────

function QuickFilterBar() {
  const appState = useAppState();
  const s = appState.settings;

  function cyclePrice() {
    const idx = PRICE_CYCLE.findIndex((o) => o.value === s.maxPrice);
    const next = PRICE_CYCLE[(idx + 1) % PRICE_CYCLE.length]!;
    updateSettings({ maxPrice: next.value });
  }
  function cycleDistance() {
    const idx = DISTANCE_CYCLE.findIndex((o) => o.value === s.defaultRadiusKm);
    const next = DISTANCE_CYCLE[(idx + 1) % DISTANCE_CYCLE.length]!;
    updateSettings({ defaultRadiusKm: next.value });
  }
  function cycleSort() {
    const idx = SORT_CYCLE.findIndex((o) => o.value === s.sortMode);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]!;
    updateSettings({ sortMode: next.value });
  }

  const priceLabel = PRICE_CYCLE.find((o) => o.value === s.maxPrice)?.label ?? "Precio";
  const distLabel = DISTANCE_CYCLE.find((o) => o.value === s.defaultRadiusKm)?.label ?? "Distancia";
  const sortLabel = SORT_CYCLE.find((o) => o.value === s.sortMode)?.label ?? "Orden";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.qfScroll}
      contentContainerStyle={styles.qfRow}
    >
      {/* Abierto ahora */}
      <TouchableOpacity
        style={[styles.qfChip, s.openNow && styles.qfChipOn]}
        onPress={() => updateSettings({ openNow: !s.openNow })}
      >
        <Text style={styles.qfDot}>{s.openNow ? "🟢" : "⚫"}</Text>
        <Text style={[styles.qfText, s.openNow && styles.qfTextOn]}>
          {s.openNow ? "Abiertos" : "Todos"}
        </Text>
      </TouchableOpacity>

      {/* Radio */}
      <TouchableOpacity style={[styles.qfChip, s.defaultRadiusKm !== "all" && styles.qfChipOn]} onPress={cycleDistance}>
        <Text style={styles.qfIcon}>📍</Text>
        <Text style={[styles.qfText, s.defaultRadiusKm !== "all" && styles.qfTextOn]}>{distLabel}</Text>
        <Text style={styles.qfArrow}>›</Text>
      </TouchableOpacity>

      {/* Precio */}
      <TouchableOpacity style={[styles.qfChip, s.maxPrice !== "all" && styles.qfChipOn]} onPress={cyclePrice}>
        <Text style={styles.qfIcon}>💰</Text>
        <Text style={[styles.qfText, s.maxPrice !== "all" && styles.qfTextOn]}>{priceLabel}</Text>
        <Text style={styles.qfArrow}>›</Text>
      </TouchableOpacity>

      {/* Orden */}
      <TouchableOpacity style={[styles.qfChip, s.sortMode !== "best" && styles.qfChipOn]} onPress={cycleSort}>
        <Text style={styles.qfIcon}>↕</Text>
        <Text style={[styles.qfText, s.sortMode !== "best" && styles.qfTextOn]}>{sortLabel}</Text>
        <Text style={styles.qfArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const [dishText, setDishText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

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
    const q = dish.trim();
    if (!q) return;
    setDishText(q);
    setSuggestOpen(false);
    setSelectedRestaurant(null);
    addRecentSearch(q);
    addSmartHistory(q);
    void search(q);
  }

  // Auto-búsqueda cuando viene desde Favoritos (categoría guardada)
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
    const unsaved = ALL_CAT_DISHES.filter(
      (c) => normalizeText(c).includes(q) && !appState.savedCategories.includes(c),
    );
    return { saved, unsaved };
  }, [dishText, appState.savedCategories]);

  const showSuggestions = suggestOpen && suggestions !== null;

  const results = getFilteredResults(dishText);
  const hasError = appState.providerErrorMessage !== "";
  const hasSearched = appState.activeRestaurants.length > 0 || hasError || loading;

  const mapResults = getFilteredResults("");
  const mapSelected = mapResults.find((r) => r.id === appState.selectedRestaurantId) || mapResults[0] || null;
  const mapHtml = useMemo(
    () => buildLeafletHtml(appState.currentLocation, mapResults, mapSelected?.id ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appState.currentLocation.latitude, appState.currentLocation.longitude, mapResults.length, mapSelected?.id],
  );

  function getCatEmoji(dish: string): string | null {
    return CATEGORIES.find((c) => c.dish === dish)?.emoji ?? null;
  }

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>🍴</Text>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>SavvyFoodie</Text>
            <TouchableOpacity onPress={() => setView("profile")}>
              <Text style={styles.locationChip} numberOfLines={1}>{appState.currentLocation.label}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista / Mapa toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, !mapMode && styles.toggleBtnActive]}
            onPress={() => setMapMode(false)}
          >
            <Text style={[styles.toggleBtnText, !mapMode && styles.toggleBtnTextActive]}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mapMode && styles.toggleBtnActive]}
            onPress={() => setMapMode(true)}
          >
            <Text style={[styles.toggleBtnText, mapMode && styles.toggleBtnTextActive]}>Mapa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search box */}
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

      {/* Content */}
      {showSuggestions ? (
        /* ── Sugerencias ── */
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
                  <Text style={styles.suggestLabel}>
                    {getCatEmoji(cat) ? `${getCatEmoji(cat)} ` : ""}{cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {suggestions!.unsaved.length > 0 && (
            <>
              <Text style={styles.suggestSection}>Categorías</Text>
              {suggestions!.unsaved.map((cat) => (
                <TouchableOpacity key={cat} style={styles.suggestRow} onPress={() => searchDish(cat)}>
                  <Text style={styles.suggestLabel}>
                    {getCatEmoji(cat) ? `${getCatEmoji(cat)} ` : ""}{cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Raw query */}
          <TouchableOpacity style={styles.suggestRaw} onPress={() => searchDish(dishText)}>
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.suggestRawText}>Buscar "{dishText}"</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : mapMode ? (
        /* ── Vista Mapa ── */
        <ScrollView contentContainerStyle={styles.mapContent} showsVerticalScrollIndicator={false}>
          <QuickFilterBar />
          <View style={styles.mapFrame}>
            {WebView ? (
              <WebView
                source={{ html: mapHtml }}
                style={styles.webview}
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

          {mapResults.length > 0 && (
            <View style={styles.placeList}>
              {mapResults.slice(0, 8).map((r, i) => {
                const active = r.id === mapSelected?.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.placeItem, active && styles.placeItemActive]}
                    onPress={() => setSelectedRestaurant(r.id)}
                  >
                    <Text style={styles.placeName} numberOfLines={1}>{i + 1}. {r.name}</Text>
                    <Text style={styles.placeMeta}>A {(r.distanceKm ?? 0).toFixed(1)} km</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {mapResults.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin restaurantes en el mapa</Text>
              <Text style={styles.emptyText}>Haz una búsqueda en la vista de lista para verlos aquí.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* ── Vista Lista ── */
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <QuickFilterBar />

          {/* Resultados */}
          <View style={styles.block}>
            <View style={styles.sectionHeading}>
              {hasSearched && !loading && (
                <View style={styles.resultCount}>
                  <Text style={styles.resultCountText}>{results.length} {results.length === 1 ? "lugar" : "lugares"}</Text>
                </View>
              )}
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>Buscando restaurantes…</Text>
              </View>
            ) : hasError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Google Places no está conectado</Text>
                <Text style={styles.emptyText}>{appState.providerErrorMessage}</Text>
              </View>
            ) : results.length === 0 && appState.activeRestaurants.length > 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Sin resultados con estos filtros</Text>
                <Text style={styles.emptyText}>Prueba con otra comida o cambia los filtros.</Text>
              </View>
            ) : appState.activeRestaurants.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Empieza una búsqueda</Text>
                <Text style={styles.emptyText}>Elige una categoría o escribe tu antojo arriba.</Text>
              </View>
            ) : (
              <View style={styles.resultsList}>
                {results.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 28 },
  brand: { alignItems: "center", flexDirection: "row", flex: 1, gap: 12, minWidth: 0 },
  brandMark: { color: theme.accent, fontSize: 30 },
  brandText: { flex: 1, minWidth: 0 },
  brandTitle: { color: theme.text, fontSize: 26, fontWeight: "900" },
  clearBtn: { color: theme.muted2, fontSize: 24, fontWeight: "700", paddingHorizontal: 6 },
  content: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 },
  emptyState: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderStyle: "dashed", borderWidth: 1, padding: 22 },
  emptyText: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { color: theme.muted, fontSize: 14, marginTop: 12 },
  locationChip: { color: theme.muted, fontSize: 13, fontWeight: "800", marginTop: 2 },
  // Quick filter bar
  qfArrow: { color: theme.muted2, fontSize: 16, fontWeight: "700" },
  qfChip: {
    alignItems: "center",
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  qfChipOn: { backgroundColor: theme.accentChipBg, borderColor: "rgba(169,133,255,0.5)" },
  qfDot: { fontSize: 11 },
  qfIcon: { fontSize: 13 },
  qfRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  qfScroll: { borderBottomColor: theme.line, borderBottomWidth: 1 },
  qfText: { color: theme.muted, fontSize: 12.5, fontWeight: "700" },
  qfTextOn: { color: theme.accentChipText },
  mapContent: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 16 },
  mapFallback: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  mapFallbackIcon: { fontSize: 48, marginBottom: 12 },
  mapFallbackText: { color: theme.accent, fontSize: 16, fontWeight: "900" },
  mapFrame: { aspectRatio: 3 / 4, backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 20, borderWidth: 1, minHeight: 360, overflow: "hidden" },
  placeItem: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 16, borderWidth: 1, padding: 12 },
  placeItemActive: { borderColor: theme.accent },
  placeList: { gap: 10, marginTop: 14 },
  placeMeta: { color: theme.muted, fontSize: 13, marginTop: 4 },
  placeName: { color: theme.text, fontSize: 15, fontWeight: "700" },
  resultCount: { backgroundColor: theme.accentChipBg, borderRadius: 999, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  resultCountText: { color: theme.accentChipText, fontSize: 13, fontWeight: "900" },
  resultsList: { gap: 14 },
  screen: { backgroundColor: theme.bg, flex: 1 },
  searchBox: {
    alignItems: "center",
    backgroundColor: theme.searchBg,
    borderColor: theme.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  searchIcon: { color: theme.muted, fontSize: 28 },
  searchInput: { color: theme.text, flex: 1, fontSize: 16, fontWeight: "700" },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  suggestContent: { paddingBottom: 80 },
  suggestLabel: { color: theme.text, flex: 1, fontSize: 15, fontWeight: "700" },
  suggestRaw: {
    alignItems: "center",
    borderTopColor: theme.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  suggestRawText: { color: theme.muted, fontSize: 15, fontStyle: "italic" },
  suggestRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  suggestScroll: { flex: 1 },
  suggestSection: { color: theme.muted, fontSize: 12, fontWeight: "900", letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, textTransform: "uppercase" },
  suggestStar: { color: theme.accent, fontSize: 16 },
  toggleBtn: { borderColor: theme.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  toggleBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  toggleBtnText: { color: theme.muted, fontSize: 13, fontWeight: "800" },
  toggleBtnTextActive: { color: "#111015" },
  topBar: {
    alignItems: "center",
    backgroundColor: "rgba(8, 9, 13, 0.98)",
    borderBottomColor: theme.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  viewToggle: { flexDirection: "row", gap: 6 },
  webview: { backgroundColor: theme.panel2, flex: 1 },
});
