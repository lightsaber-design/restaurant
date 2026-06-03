import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "../hooks/useAppState";
import { clearLocalAppData, updateSettings } from "../state/store";
import { appConfig } from "../config";

const FOOD_PREFERENCES = [
  "hamburguesas", "sushi", "pizza", "pasta", "tacos", "ramen",
  "ensalada", "pollo", "mariscos", "vegano", "tapas", "bocadillos",
  "kebab", "curry", "mexicana", "paella",
];

type Opt<T extends string> = { label: string; value: T };

function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, value === opt.value && styles.chipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.chipText, value === opt.value && styles.chipTextActive]}>{opt.label}</Text>
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
  const [devOpen, setDevOpen] = useState(false);

  function toggleFoodPreference(food: string) {
    const prefs = s.foodPreferences.includes(food)
      ? s.foodPreferences.filter((f) => f !== food)
      : [...s.foodPreferences, food];
    updateSettings({ foodPreferences: prefs });
  }

  function handleClearData() {
    Alert.alert(
      "Borrar datos",
      "Se eliminarán todos tus favoritos, búsquedas recientes y ajustes. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar todo", style: "destructive", onPress: () => void clearLocalAppData() },
      ],
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Ajustes</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Search settings */}
        <Text style={styles.section}>Búsqueda</Text>
        <OptionPicker
          label="Radio por defecto"
          value={s.defaultRadiusKm}
          onChange={(v) => updateSettings({ defaultRadiusKm: v })}
          options={[
            { label: "Todos", value: "all" },
            { label: "1 km", value: "1" },
            { label: "3 km", value: "3" },
            { label: "5 km", value: "5" },
          ]}
        />
        <OptionPicker
          label="Presupuesto"
          value={s.budgetLevel}
          onChange={(v) => updateSettings({ budgetLevel: v })}
          options={[
            { label: "Cualquiera", value: "any" },
            { label: "Económico", value: "cheap" },
            { label: "Medio", value: "medium" },
            { label: "Premium", value: "premium" },
          ]}
        />
        <OptionPicker
          label="Idioma"
          value={s.language}
          onChange={(v) => updateSettings({ language: v })}
          options={[
            { label: "ES", value: "es" },
            { label: "EN", value: "en" },
            { label: "FR", value: "fr" },
            { label: "DE", value: "de" },
            { label: "IT", value: "it" },
            { label: "PT", value: "pt" },
          ]}
        />

        {/* Maps mode */}
        <Text style={styles.section}>Maps</Text>
        <OptionPicker
          label="Cómo abrir Maps"
          value={s.mapsMode}
          onChange={(v) => updateSettings({ mapsMode: v })}
          options={[
            { label: "Nueva pestaña", value: "new-tab" },
            { label: "Misma pestaña", value: "same-tab" },
            { label: "App externa", value: "external-app" },
          ]}
        />

        {/* Food preferences */}
        <Text style={styles.section}>Preferencias de comida</Text>
        <Text style={styles.sectionHint}>
          Selecciona tus comidas favoritas para buscarlas rápidamente desde Explorar.
        </Text>
        <View style={styles.prefGrid}>
          {FOOD_PREFERENCES.map((food) => {
            const active = s.foodPreferences.includes(food);
            return (
              <TouchableOpacity
                key={food}
                style={[styles.prefChip, active && styles.prefChipActive]}
                onPress={() => toggleFoodPreference(food)}
              >
                <Text style={[styles.prefChipText, active && styles.prefChipTextActive]}>{food}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Data */}
        <Text style={styles.section}>Datos</Text>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Modo desarrollador</Text>
          <Switch
            value={s.developerMode}
            onValueChange={(v) => { updateSettings({ developerMode: v }); if (v) setDevOpen(true); }}
            trackColor={{ true: "#E8750A" }}
          />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Favoritos guardados</Text>
          <Text style={styles.infoValue}>{appState.favorites.length}</Text>
        </View>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData} activeOpacity={0.8}>
          <Text style={styles.dangerBtnText}>🗑 Borrar todos los datos</Text>
        </TouchableOpacity>

        {/* Developer panel */}
        {s.developerMode && (
          <View style={styles.devPanel}>
            <TouchableOpacity onPress={() => setDevOpen((v) => !v)} style={styles.devHeader}>
              <Text style={styles.devTitle}>Panel de desarrollador</Text>
              <Text style={styles.devToggle}>{devOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {devOpen && (
              <View style={styles.devContent}>
                {[
                  ["Versión", appConfig.appVersion],
                  ["Endpoint", appConfig.api.placesSearchPath],
                  ["API Base", appConfig.api.baseUrl],
                  ["Radio", s.defaultRadiusKm === "all" ? "Sin límite" : `${s.defaultRadiusKm} km`],
                  ["Restaurantes cargados", String(appState.activeRestaurants.length)],
                  ["Error proveedor", appState.providerErrorMessage || "Sin errores"],
                ].map(([label, value]) => (
                  <View key={label} style={styles.devRow}>
                    <Text style={styles.devLabel}>{label}</Text>
                    <Text style={styles.devValue} numberOfLines={1}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <Text style={styles.version}>SavvyFoodie v{appConfig.appVersion}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: "#F0F0F0", borderRadius: 8, marginBottom: 4, marginRight: 6, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: "#E8750A" },
  chipText: { color: "#555", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  content: { paddingBottom: 40, paddingHorizontal: 16, paddingTop: 12 },
  dangerBtn: { alignItems: "center", backgroundColor: "#FFE0E0", borderRadius: 10, marginTop: 12, paddingVertical: 14 },
  dangerBtnText: { color: "#C00", fontWeight: "600" },
  devContent: { paddingTop: 8 },
  devHeader: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  devLabel: { color: "#888", flex: 1, fontSize: 13 },
  devPanel: { backgroundColor: "#1A1A1A", borderRadius: 10, marginTop: 12, paddingHorizontal: 14 },
  devRow: { flexDirection: "row", paddingVertical: 6 },
  devTitle: { color: "#fff", fontWeight: "700" },
  devToggle: { color: "#aaa" },
  devValue: { color: "#E8750A", flex: 2, fontSize: 13, textAlign: "right" },
  header: { backgroundColor: "#1A1A1A", paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { color: "#444", fontSize: 15 },
  infoRow: { alignItems: "center", borderBottomColor: "#F0F0F0", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  infoValue: { color: "#888", fontSize: 15, fontWeight: "600" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  prefChip: { backgroundColor: "#F0F0F0", borderRadius: 20, margin: 4, paddingHorizontal: 14, paddingVertical: 8 },
  prefChipActive: { backgroundColor: "#E8750A" },
  prefChipText: { color: "#555", fontSize: 13 },
  prefChipTextActive: { color: "#fff", fontWeight: "600" },
  prefGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  row: { borderBottomColor: "#F0F0F0", borderBottomWidth: 1, paddingVertical: 12 },
  rowLabel: { color: "#444", fontSize: 15 },
  screen: { backgroundColor: "#F5F5F5", flex: 1 },
  section: { color: "#888", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4, marginTop: 20, textTransform: "uppercase" },
  sectionHint: { color: "#aaa", fontSize: 12, marginBottom: 8 },
  switchRow: { alignItems: "center", borderBottomColor: "#F0F0F0", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  version: { color: "#bbb", fontSize: 12, marginTop: 24, textAlign: "center" },
});
