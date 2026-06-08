// Lazy import — expo-location requiere build nativo
let Location: typeof import("expo-location") | null = null;
try { Location = require("expo-location"); } catch {}

import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "../hooks/useAppState";
import { clearLocalAppData, setCurrentLocation, updateSettings } from "../state/store";
import { fetchLocationSuggestions, getShortLocationName } from "../providers/geocodingProvider";
import { theme } from "../theme";
import type { GeocodingPlace } from "../types";
import { appConfig } from "../config";

const FOOD_PREFERENCES = ["vegano", "sin gluten", "halal", "saludable", "barato", "rápido"];

type Opt<T extends string> = { label: string; value: T };

function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((o) => (
          <TouchableOpacity key={o.value} style={[styles.pill, value === o.value && styles.pillActive]} onPress={() => onChange(o.value)}>
            <Text style={[styles.pillText, value === o.value && styles.pillTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const s = appState.settings;

  const [locQuery, setLocQuery] = useState("");
  const [locSuggestions, setLocSuggestions] = useState<GeocodingPlace[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function useMyLocation() {
    if (!Location) { Alert.alert("GPS no disponible", "Reconstruye el dev build para activar el GPS."); return; }
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permiso denegado", "Activa la ubicación en los ajustes del móvil."); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation("Tu ubicación", pos.coords.latitude, pos.coords.longitude);
    } catch { Alert.alert("GPS no disponible", "No se pudo obtener tu posición."); }
    finally { setGpsBusy(false); }
  }

  function onLocInput(text: string) {
    setLocQuery(text);
    if (locTimer.current) clearTimeout(locTimer.current);
    if (text.trim().length < 3) { setLocSuggestions([]); return; }
    locTimer.current = setTimeout(async () => {
      setLocSearching(true);
      try { setLocSuggestions(await fetchLocationSuggestions(text)); }
      catch { setLocSuggestions([]); }
      finally { setLocSearching(false); }
    }, 700);
  }

  function selectLoc(place: GeocodingPlace) {
    setCurrentLocation(getShortLocationName(place), Number(place.lat), Number(place.lon));
    setLocQuery(""); setLocSuggestions([]);
  }

  function toggleFood(food: string) {
    const prefs = s.foodPreferences.includes(food) ? s.foodPreferences.filter((f) => f !== food) : [...s.foodPreferences, food];
    updateSettings({ foodPreferences: prefs });
  }

  function handleClear() {
    Alert.alert("Borrar datos", "Se eliminarán favoritos, búsquedas y ajustes. ¿Continuar?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => void clearLocalAppData() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Tarjeta ubicación */}
        <View style={styles.card}>
          <Text style={styles.cardStrong}>Usando {appState.currentLocation.label}</Text>
          <Text style={styles.cardText}>Permite el acceso a tu ubicación o busca cualquier ciudad, zona o dirección del mundo.</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => void useMyLocation()} disabled={gpsBusy}>
            {gpsBusy ? <ActivityIndicator color="#111015" /> : <Text style={styles.primaryBtnText}>Usar mi ubicación</Text>}
          </TouchableOpacity>

          <TextInput
            style={styles.locInput}
            placeholder="Buscar ubicación en todo el mundo"
            placeholderTextColor={theme.muted2}
            value={locQuery}
            onChangeText={onLocInput}
          />
          {locSearching && <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />}
          {locSuggestions.map((place) => (
            <TouchableOpacity key={`${place.lat}-${place.lon}`} style={styles.suggestion} onPress={() => selectLoc(place)}>
              <Text style={styles.suggestionPrimary} numberOfLines={1}>{getShortLocationName(place)}</Text>
              <Text style={styles.suggestionSecondary} numberOfLines={1}>{place.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ajustes */}
        <View style={styles.card}>
          <Text style={styles.h3}>Ajustes</Text>
          <Picker label="Idioma" value={s.language} onChange={(v) => updateSettings({ language: v })}
            options={[{ label: "ES", value: "es" }, { label: "EN", value: "en" }, { label: "FR", value: "fr" }, { label: "DE", value: "de" }, { label: "IT", value: "it" }, { label: "PT", value: "pt" }]} />
          <Picker label="Radio por defecto" value={s.defaultRadiusKm} onChange={(v) => updateSettings({ defaultRadiusKm: v })}
            options={[{ label: "Sin límite", value: "all" }, { label: "1 km", value: "1" }, { label: "3 km", value: "3" }, { label: "5 km", value: "5" }]} />
          <Picker label="Presupuesto" value={s.budgetLevel} onChange={(v) => updateSettings({ budgetLevel: v })}
            options={[{ label: "Cualquiera", value: "any" }, { label: "Económico", value: "cheap" }, { label: "Medio", value: "medium" }, { label: "Premium", value: "premium" }]} />
          <Picker label="Modo Google Maps" value={s.mapsMode} onChange={(v) => updateSettings({ mapsMode: v })}
            options={[{ label: "Nueva pestaña", value: "new-tab" }, { label: "Dentro app", value: "same-tab" }, { label: "App externa", value: "external-app" }]} />

          {/* Preferencias */}
          <View style={styles.sectionDivider}>
            <Text style={styles.h3}>Preferencias de comida</Text>
            <View style={styles.prefGrid}>
              {FOOD_PREFERENCES.map((food) => {
                const active = s.foodPreferences.includes(food);
                return (
                  <TouchableOpacity key={food} style={[styles.prefChip, active && styles.prefChipActive]} onPress={() => toggleFood(food)}>
                    <Text style={[styles.prefText, active && styles.prefTextActive]}>{food}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Modo dev */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Modo desarrollador</Text>
            <Switch value={s.developerMode} onValueChange={(v) => updateSettings({ developerMode: v })} trackColor={{ true: theme.accent }} thumbColor="#fff" />
          </View>

          {/* Panel dev */}
          {s.developerMode && (
            <View style={styles.devPanel}>
              <Text style={styles.h3}>Diagnóstico</Text>
              {[
                ["Versión", appConfig.appVersion],
                ["Endpoint", appConfig.api.placesSearchPath],
                ["API Base", appConfig.api.baseUrl],
                ["Radio", s.defaultRadiusKm === "all" ? "Sin límite" : `${s.defaultRadiusKm} km`],
                ["Resultados", String(appState.activeRestaurants.length)],
                ["Estado", appState.providerErrorMessage || "Sin errores"],
              ].map(([k, v]) => (
                <View key={k} style={styles.devRow}>
                  <Text style={styles.devKey}>{k}</Text>
                  <Text style={styles.devVal} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Privacidad */}
          <View style={styles.sectionDivider}>
            <Text style={styles.h3}>Privacidad y datos</Text>
            <Text style={styles.cardText}>La app guarda ubicación, favoritos, preferencias y búsquedas en este dispositivo.</Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleClear}>
              <Text style={styles.dangerBtnText}>Borrar datos locales</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>SavvyFoodie v{appConfig.appVersion}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderWidth: 1, marginBottom: 28, padding: 16 },
  cardStrong: { color: theme.text, fontSize: 16, fontWeight: "800", marginBottom: 6 },
  cardText: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  content: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 16 },
  dangerBtn: { alignSelf: "flex-start", backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder, borderRadius: 999, borderWidth: 1, marginTop: 12, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  dangerBtnText: { color: theme.danger, fontWeight: "900" },
  devKey: { color: theme.muted, fontWeight: "900", width: 88 },
  devPanel: { borderTopColor: theme.line, borderTopWidth: 1, marginTop: 18, paddingTop: 18 },
  devRow: { borderBottomColor: theme.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 10 },
  devVal: { color: theme.text, flex: 1, textAlign: "right" },
  field: { marginTop: 14 },
  fieldLabel: { color: theme.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 8 },
  h3: { color: theme.text, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  header: { backgroundColor: "rgba(8, 9, 13, 0.98)", borderBottomColor: theme.line, borderBottomWidth: 1, paddingBottom: 14, paddingHorizontal: 16 },
  locInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 999, borderWidth: 1, color: theme.text, marginTop: 12, minHeight: 48, paddingHorizontal: 16 },
  pill: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  pillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pillText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  pillTextActive: { color: "#111015" },
  prefChip: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  prefChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  prefGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  prefText: { color: theme.text, fontSize: 13, fontWeight: "800" },
  prefTextActive: { color: "#111015" },
  primaryBtn: { alignItems: "center", backgroundColor: theme.accent, borderRadius: 999, marginTop: 16, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  primaryBtnText: { color: "#111015", fontWeight: "900" },
  screen: { backgroundColor: theme.bg, flex: 1 },
  sectionDivider: { borderTopColor: theme.line, borderTopWidth: 1, marginTop: 18, paddingTop: 18 },
  suggestion: { borderBottomColor: theme.line, borderBottomWidth: 1, paddingVertical: 13 },
  suggestionPrimary: { color: theme.text, fontSize: 15, fontWeight: "800" },
  suggestionSecondary: { color: theme.muted, fontSize: 12.5, marginTop: 4 },
  switchLabel: { color: theme.muted, fontSize: 14, fontWeight: "800" },
  switchRow: { alignItems: "center", borderTopColor: theme.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 16 },
  title: { color: theme.text, fontSize: 24, fontWeight: "800" },
  version: { color: theme.muted2, fontSize: 12, marginBottom: 12, textAlign: "center" },
});
