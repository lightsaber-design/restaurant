import * as Location from "expo-location";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RestaurantCard from "../components/RestaurantCard";
import { useAppState } from "../hooks/useAppState";
import { fetchLocationSuggestions, getShortLocationName } from "../providers/geocodingProvider";
import { fetchNearbyRestaurants, getProviderErrorMessage } from "../providers/placesProvider";
import {
  addRecentSearch,
  addSmartHistory,
  setCurrentLocation,
  setProviderError,
  setRestaurants,
  setSortMode,
  updateSettings,
} from "../state/store";
import { getFilteredResults } from "../selectors";
import type { GeocodingPlace } from "../types";

const SORT_LABELS: Record<string, string> = { best: "Mejor", nearest: "Más cercano", favorites: "Favoritos" };
const PRICE_OPTIONS = [
  { label: "Todos", value: "all" },
  { label: "€", value: "10" },
  { label: "€€", value: "15" },
  { label: "€€€", value: "20" },
] as const;

type PriceValue = "all" | "10" | "15" | "20";

export default function ExploreScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const [dishText, setDishText] = useState("");
  const [priceFilter, setPriceFilter] = useState<PriceValue>("all");
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodingPlace[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleSearch() {
    const q = dishText.trim();
    addRecentSearch(q);
    addSmartHistory(q);
    void search(q);
  }

  async function requestGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCurrentLocation("Tu ubicación", pos.coords.latitude, pos.coords.longitude);
    void search(dishText.trim());
  }

  function handleLocationInput(text: string) {
    setLocationQuery(text);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    if (text.trim().length < 3) { setLocationSuggestions([]); return; }
    locationTimer.current = setTimeout(async () => {
      setLocationSearching(true);
      try { setLocationSuggestions(await fetchLocationSuggestions(text)); }
      catch { setLocationSuggestions([]); }
      finally { setLocationSearching(false); }
    }, 700);
  }

  function selectLocation(place: GeocodingPlace) {
    setCurrentLocation(getShortLocationName(place), Number(place.lat), Number(place.lon));
    setLocationModalOpen(false);
    setLocationQuery("");
    setLocationSuggestions([]);
    void search(dishText.trim());
  }

  const results = getFilteredResults(dishText, priceFilter, appState.settings.defaultRadiusKm);
  const mapQuery = encodeURIComponent(`${dishText || "restaurante"} cerca de ${appState.currentLocation.label}`);
  const mapUrl = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
  const hasError = appState.providerErrorMessage !== "";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍽 SavvyFoodie</Text>
        <TouchableOpacity style={styles.locationBtn} onPress={() => setLocationModalOpen(true)}>
          <Text style={styles.locationLabel} numberOfLines={1}>📍 {appState.currentLocation.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gpsBtn} onPress={requestGPS}>
          <Text style={styles.gpsBtnText}>GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="¿Qué quieres comer?"
          placeholderTextColor="#aaa"
          value={dishText}
          onChangeText={setDishText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Filters row */}
      <View style={styles.filtersScroll}>
        {/* Sort */}
        {(["best", "nearest", "favorites"] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.chip, appState.settings.sortMode === mode && styles.chipActive]}
            onPress={() => setSortMode(mode)}
          >
            <Text style={[styles.chipText, appState.settings.sortMode === mode && styles.chipTextActive]}>
              {SORT_LABELS[mode]}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Radius */}
        {(["all", "1", "3", "5"] as const).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, appState.settings.defaultRadiusKm === r && styles.chipActive]}
            onPress={() => updateSettings({ defaultRadiusKm: r })}
          >
            <Text style={[styles.chipText, appState.settings.defaultRadiusKm === r && styles.chipTextActive]}>
              {r === "all" ? "Todos" : `${r} km`}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Price */}
        {PRICE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, priceFilter === opt.value && styles.chipActive]}
            onPress={() => setPriceFilter(opt.value)}
          >
            <Text style={[styles.chipText, priceFilter === opt.value && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View toggle + result count */}
      {appState.activeRestaurants.length > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.resultCount}>{results.length} {results.length === 1 ? "lugar" : "lugares"}</Text>
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
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#E8750A" />
          <Text style={styles.loadingText}>Buscando restaurantes…</Text>
        </View>
      )}

      {/* Error */}
      {!loading && hasError && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{appState.providerErrorMessage}</Text>
          <TouchableOpacity
            style={styles.mapsLink}
            onPress={() => void Linking.openURL(`https://www.google.com/maps/search/${mapQuery}`)}
          >
            <Text style={styles.mapsLinkText}>Abrir Google Maps →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map view */}
      {!loading && !hasError && mapMode && appState.activeRestaurants.length > 0 && (
        <WebView source={{ uri: mapUrl }} style={styles.map} />
      )}

      {/* List view */}
      {!loading && !hasError && !mapMode && (
        appState.activeRestaurants.length === 0 ? (
          <View style={styles.recent}>
            <Text style={styles.recentTitle}>Búsquedas recientes</Text>
            <View style={styles.recentRow}>
              {appState.recentSearches.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.recentChip}
                  onPress={() => { setDishText(s); addRecentSearch(s); void search(s); }}
                >
                  <Text style={styles.recentChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {appState.settings.foodPreferences.length > 0 && (
              <TouchableOpacity
                style={styles.prefBtn}
                onPress={() => {
                  const q = appState.settings.foodPreferences.join(" ");
                  setDishText(q);
                  void search(q);
                }}
              >
                <Text style={styles.prefBtnText}>🍴 Buscar mis preferencias</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          results.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>No se encontraron resultados.</Text>
              <TouchableOpacity
                style={styles.mapsLink}
                onPress={() => void Linking.openURL(`https://www.google.com/maps/search/${mapQuery}`)}
              >
                <Text style={styles.mapsLinkText}>Abrir en Google Maps →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <RestaurantCard restaurant={item} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )
        )
      )}

      {/* Location modal */}
      <Modal visible={locationModalOpen} animationType="slide" transparent onRequestClose={() => setLocationModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar ubicación</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Escribe una ciudad o dirección…"
              placeholderTextColor="#aaa"
              value={locationQuery}
              onChangeText={handleLocationInput}
              autoFocus
            />
            {locationSearching && <ActivityIndicator color="#E8750A" style={{ marginVertical: 8 }} />}
            {locationSuggestions.map((place, i) => (
              <TouchableOpacity key={i} style={styles.suggestion} onPress={() => selectLocation(place)}>
                <Text style={styles.suggestionText} numberOfLines={2}>{place.display_name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLocationModalOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cancelBtn: { alignItems: "center", marginTop: 12, paddingVertical: 10 },
  cancelBtnText: { color: "#888", fontSize: 15 },
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  chip: { backgroundColor: "#F0F0F0", borderRadius: 20, marginBottom: 4, marginRight: 6, paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: "#E8750A" },
  chipText: { color: "#555", fontSize: 12, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  errorText: { color: "#C00", fontSize: 15, textAlign: "center" },
  filtersScroll: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingVertical: 8 },
  gpsBtn: { backgroundColor: "#E8750A", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  gpsBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  header: { alignItems: "center", backgroundColor: "#1A1A1A", flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  input: { backgroundColor: "#fff", borderColor: "#ddd", borderRadius: 10, borderWidth: 1, flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 10 },
  list: { paddingBottom: 20, paddingTop: 8 },
  loadingText: { color: "#666", fontSize: 14, marginTop: 12 },
  locationBtn: { flex: 1 },
  locationLabel: { color: "#fff", fontSize: 13 },
  map: { flex: 1 },
  mapsLink: { marginTop: 12 },
  mapsLinkText: { color: "#E8750A", fontSize: 14, fontWeight: "600" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", padding: 20, width: "100%" },
  modalInput: { backgroundColor: "#F5F5F5", borderRadius: 10, fontSize: 15, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10 },
  modalOverlay: { backgroundColor: "rgba(0,0,0,0.4)", flex: 1, justifyContent: "flex-end" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  prefBtn: { backgroundColor: "#FFF3E0", borderRadius: 10, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10 },
  prefBtnText: { color: "#E8750A", fontWeight: "600" },
  recent: { padding: 16 },
  recentChip: { backgroundColor: "#F5F5F5", borderRadius: 16, marginBottom: 6, marginRight: 8, paddingHorizontal: 14, paddingVertical: 7 },
  recentChipText: { color: "#444", fontSize: 13 },
  recentRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  recentTitle: { color: "#888", fontSize: 13, fontWeight: "600" },
  resultCount: { color: "#666", fontSize: 13 },
  screen: { backgroundColor: "#F5F5F5", flex: 1 },
  searchBtn: { backgroundColor: "#E8750A", borderRadius: 10, marginLeft: 8, paddingHorizontal: 16, paddingVertical: 10 },
  searchBtnText: { color: "#fff", fontWeight: "700" },
  searchRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10 },
  suggestion: { borderTopColor: "#F0F0F0", borderTopWidth: 1, paddingVertical: 12 },
  suggestionText: { color: "#333", fontSize: 14 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginRight: 8 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 5 },
  toggleBtnActive: { backgroundColor: "#E8750A", borderRadius: 8 },
  toggleBtnText: { color: "#666", fontSize: 13, fontWeight: "600" },
  toggleBtnTextActive: { color: "#fff" },
  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 6 },
  viewToggle: { backgroundColor: "#F0F0F0", borderRadius: 10, flexDirection: "row", padding: 2 },
});
