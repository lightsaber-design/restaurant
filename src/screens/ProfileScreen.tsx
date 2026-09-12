let Location: typeof import("expo-location") | null = null;
try { Location = require("expo-location"); } catch {}

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AntojoLogo } from "../components/AntojoLogo";
import { Icon } from "../components/Icon";
import { useAppState } from "../hooks/useAppState";
import { fetchLocationSuggestions, getShortLocationName } from "../providers/geocodingProvider";
import { clearLocalAppData, setCurrentLocation, updateSettings } from "../state/store";
import { theme } from "../theme";
import type { GeocodingPlace } from "../types";
import { appConfig } from "../config";

// ─── Label maps ──────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  es: "Español", en: "English", fr: "Français", de: "Deutsch", it: "Italiano", pt: "Português",
};
const LANG_TO_STORE: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_LABELS).map(([k, v]) => [v, k])
);

const RADIUS_TO_LABEL: Record<string, string> = { "1": "1 km", "3": "3 km", "5": "5 km", all: "Sin límite" };
const RADIUS_TO_STORE: Record<string, string> = { "1 km": "1", "3 km": "3", "5 km": "5", "Sin límite": "all" };

const BUDGET_LABELS: Record<string, string> = {
  any: "Cualquiera", cheap: "Económico", medium: "Medio", premium: "Premium",
};
const BUDGET_TO_STORE: Record<string, string> = Object.fromEntries(
  Object.entries(BUDGET_LABELS).map(([k, v]) => [v, k])
);

const MAPS_LABELS: Record<string, string> = {
  "same-tab": "Dentro de la app", "new-tab": "Nueva pestaña", "external-app": "App externa",
};
const MAPS_TO_STORE: Record<string, string> = Object.fromEntries(
  Object.entries(MAPS_LABELS).map(([k, v]) => [v, k])
);

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const active = value === o;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            style={[pg.pill, active && pg.pillActive]}
            activeOpacity={0.75}
          >
            <Text style={[pg.text, active && pg.textActive]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pg = StyleSheet.create({
  pill: {
    height: 34, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: theme.panel2, borderWidth: 1, borderColor: theme.line,
    justifyContent: "center",
  },
  pillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  text: { fontSize: 13.5, fontWeight: "700", color: theme.muted },
  textActive: { color: theme.onAccent },
});

// ─── RadiusSlider ─────────────────────────────────────────────────────────────

const RADIUS_STOPS = ["1 km", "3 km", "5 km", "Sin límite"];

function RadiusSlider({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const idx = Math.max(0, RADIUS_STOPS.indexOf(value));
  const pct = idx / (RADIUS_STOPS.length - 1);

  return (
    <View style={{ paddingVertical: 4 }}>
      {/* Track */}
      <View style={rs.trackWrap}>
        <View style={rs.trackBg} />
        <View style={[rs.trackFill, { width: `${pct * 100}%` as any }]} />
        {/* Stop dots */}
        <View style={rs.dotsRow}>
          {RADIUS_STOPS.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => onChange(s)} style={rs.dotHit} activeOpacity={0.7}>
              <View style={[rs.dot, { backgroundColor: i <= idx ? theme.accent : theme.panel2, width: i === idx ? 18 : 10, height: i === idx ? 18 : 10, borderWidth: i === idx ? 2 : 0 }]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {/* Labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        {RADIUS_STOPS.map((s, i) => (
          <TouchableOpacity key={s} onPress={() => onChange(s)}>
            <Text style={[rs.label, i === idx && rs.labelActive]}>
              {s === "Sin límite" ? "∞" : s.replace(" km", "")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  trackWrap: { height: 28, justifyContent: "center" },
  trackBg: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 99, backgroundColor: theme.panel2 },
  trackFill: { position: "absolute", left: 0, height: 4, borderRadius: 99, backgroundColor: theme.accent },
  dotsRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between" },
  dotHit: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginHorizontal: -14 },
  dot: { borderRadius: 99, borderColor: "#fff" },
  label: { fontSize: 11, fontWeight: "600", color: theme.muted2 },
  labelActive: { fontWeight: "800", color: theme.text },
});

// ─── ExpandRow ────────────────────────────────────────────────────────────────

type ExpandRowProps = {
  icon: string;
  label: string;
  value: string;
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  last?: boolean;
  children: React.ReactNode;
};

function ExpandRow({ icon, label, value, id, openId, setOpenId, last, children }: ExpandRowProps) {
  const open = openId === id;

  function toggle() {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext({
        duration: 240,
        create: { type: "easeInEaseOut", property: "opacity" },
        update: { type: "easeInEaseOut" },
        delete: { type: "easeInEaseOut", property: "opacity" },
      });
    }
    setOpenId(open ? null : id);
  }

  const webCollapseStyle: any = Platform.OS === "web" ? {
    maxHeight: open ? 220 : 0,
    overflow: "hidden",
    opacity: open ? 1 : 0,
    transition: "max-height 0.26s ease, opacity 0.2s ease",
  } : {};

  return (
    <View style={{ borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.line }}>
      <TouchableOpacity style={er.row} onPress={toggle} activeOpacity={0.7}>
        <View style={er.iconSquare}>
          <Icon name={icon} size={17} color={theme.accent} />
        </View>
        <Text style={er.label}>{label}</Text>
        <Text style={er.value}>{value}</Text>
        <Icon name={open ? "expand-less" : "expand-more"} size={20} color={theme.muted2} />
      </TouchableOpacity>

      {Platform.OS === "web" ? (
        <View style={webCollapseStyle}>
          <View style={er.content}>{children}</View>
        </View>
      ) : (
        open && <View style={er.content}>{children}</View>
      )}
    </View>
  );
}

const er = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 15, paddingHorizontal: 2 },
  iconSquare: { width: 30, height: 30, borderRadius: 9, backgroundColor: theme.panel2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconText: { fontSize: 14 },
  label: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.text },
  value: { fontSize: 13.5, fontWeight: "700", color: theme.muted },
  chevron: { fontSize: 18, fontWeight: "300", color: theme.muted2, transform: [{ rotate: "90deg" }] },
  chevronOpen: { transform: [{ rotate: "-90deg" }] },
  content: { paddingLeft: 43, paddingBottom: 18, paddingRight: 2 },
});

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({ icon, title, sub, value, onChange, last }: {
  icon: string; title: string; sub?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[tr.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
      <View style={tr.iconSquare}>
        <Icon name={icon} size={17} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tr.title}>{title}</Text>
        {sub && <Text style={tr.sub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.panel2 }}
        thumbColor="#fff"
      />
    </View>
  );
}

const tr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 2 },
  iconSquare: { width: 30, height: 30, borderRadius: 9, backgroundColor: theme.panel2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconText: { fontSize: 14 },
  title: { fontSize: 15, fontWeight: "700", color: theme.text },
  sub: { fontSize: 12.5, fontWeight: "500", color: theme.muted, marginTop: 1 },
});

// ─── Group ────────────────────────────────────────────────────────────────────

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={g.wrap}>
      <Text style={g.label}>{label}</Text>
      <View style={g.card}>{children}</View>
    </View>
  );
}

const g = StyleSheet.create({
  wrap: { marginTop: 24, marginHorizontal: 18 },
  label: { fontSize: 11.5, fontWeight: "800", color: theme.muted2, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8, marginHorizontal: 4 },
  card: { backgroundColor: theme.panel, borderRadius: 18, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 16 },
});

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const s = appState.settings;

  // Location change panel
  const [showLocSearch, setShowLocSearch] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [locSuggestions, setLocSuggestions] = useState<GeocodingPlace[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accordion
  const [openId, setOpenId] = useState<string | null>(null);

  // Notifications (local only — no push backend)
  const [notifications, setNotifications] = useState(true);

  async function useMyLocation() {
    if (!Location) {
      Alert.alert("GPS no disponible", "Reconstruye el dev build para activar el GPS.");
      return;
    }
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Activa la ubicación en los ajustes del móvil.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation("Tu ubicación", pos.coords.latitude, pos.coords.longitude);
      setShowLocSearch(false);
    } catch {
      Alert.alert("GPS no disponible", "No se pudo obtener tu posición.");
    } finally {
      setGpsBusy(false);
    }
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
    setLocQuery(""); setLocSuggestions([]); setShowLocSearch(false);
  }

  function toggleLocPanel() {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setShowLocSearch((v) => !v);
    setLocQuery(""); setLocSuggestions([]);
  }

  function handleClear() {
    Alert.alert("Borrar datos", "Se eliminarán favoritos, búsquedas y ajustes. ¿Continuar?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => void clearLocalAppData() },
    ]);
  }

  const savedCount = appState.favorites.length;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLogo}>
            <AntojoLogo size={20} c="#FFFFFF" bg={theme.accent} bite={theme.secondary} />
          </View>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 80) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hola, foodie 👋</Text>
            <Text style={styles.stats}>{savedCount} guardados</Text>
          </View>
        </View>

        {/* Ubicación */}
        <Group label="Ubicación">
          <View style={styles.locRow}>
            <View style={[er.iconSquare, { backgroundColor: theme.accentSoft }]}>
              <Icon name="place" size={17} color={theme.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.locName} numberOfLines={1}>{appState.currentLocation.label}</Text>
              <Text style={styles.locSub}>Ubicación actual</Text>
            </View>
            <TouchableOpacity style={styles.cambiarBtn} onPress={toggleLocPanel} activeOpacity={0.75}>
              <Icon name="my-location" size={14} color={theme.text} />
              <Text style={styles.cambiarText}>Cambiar</Text>
            </TouchableOpacity>
          </View>

          {/* Expandable location search */}
          {(Platform.OS === "web" ? true : showLocSearch) && (
            <View
              style={Platform.OS === "web" ? {
                maxHeight: showLocSearch ? 500 : 0,
                overflow: "hidden" as any,
                opacity: showLocSearch ? 1 : 0,
                transition: "max-height 0.26s ease, opacity 0.2s ease",
              } as any : {}}
            >
              <View style={styles.locPanel}>
                <TouchableOpacity style={styles.gpsBtn} onPress={() => void useMyLocation()} disabled={gpsBusy}>
                  {gpsBusy
                    ? <ActivityIndicator color={theme.onAccent} />
                    : <Text style={styles.gpsBtnText}>Usar mi ubicación (GPS)</Text>}
                </TouchableOpacity>
                <TextInput
                  style={styles.locInput}
                  placeholder="Buscar ciudad, zona o dirección…"
                  placeholderTextColor={theme.muted2}
                  value={locQuery}
                  onChangeText={onLocInput}
                />
                {locSearching && <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} />}
                {locSuggestions.map((place) => (
                  <TouchableOpacity
                    key={`${place.lat}-${place.lon}`}
                    style={styles.suggestion}
                    onPress={() => selectLoc(place)}
                  >
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>{getShortLocationName(place)}</Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>{place.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Group>

        {/* Preferencias */}
        <Group label="Preferencias">
          <ExpandRow icon="language" label="Idioma" value={LANG_LABELS[s.language] ?? s.language} id="lang" openId={openId} setOpenId={setOpenId}>
            <PillGroup
              options={["Español", "English", "Français", "Deutsch", "Italiano", "Português"]}
              value={LANG_LABELS[s.language] ?? s.language}
              onChange={(v) => updateSettings({ language: (LANG_TO_STORE[v] ?? "es") as typeof s.language })}
            />
          </ExpandRow>
          <ExpandRow icon="radar" label="Radio de búsqueda" value={RADIUS_TO_LABEL[s.defaultRadiusKm] ?? `${s.defaultRadiusKm} km`} id="radius" openId={openId} setOpenId={setOpenId}>
            <RadiusSlider
              value={RADIUS_TO_LABEL[s.defaultRadiusKm] ?? "3 km"}
              onChange={(v) => updateSettings({ defaultRadiusKm: RADIUS_TO_STORE[v] ?? "3" })}
            />
          </ExpandRow>
          <ExpandRow icon="payments" label="Presupuesto" value={BUDGET_LABELS[s.budgetLevel] ?? s.budgetLevel} id="budget" openId={openId} setOpenId={setOpenId}>
            <PillGroup
              options={["Cualquiera", "Económico", "Medio", "Premium"]}
              value={BUDGET_LABELS[s.budgetLevel] ?? "Cualquiera"}
              onChange={(v) => updateSettings({ budgetLevel: (BUDGET_TO_STORE[v] ?? "any") as typeof s.budgetLevel })}
            />
          </ExpandRow>
          <ExpandRow icon="map" label="Abrir en Maps" value={MAPS_LABELS[s.mapsMode] ?? s.mapsMode} id="maps" openId={openId} setOpenId={setOpenId} last>
            <PillGroup
              options={["Dentro de la app", "Nueva pestaña", "App externa"]}
              value={MAPS_LABELS[s.mapsMode] ?? "Nueva pestaña"}
              onChange={(v) => updateSettings({ mapsMode: (MAPS_TO_STORE[v] ?? "new-tab") as typeof s.mapsMode })}
            />
          </ExpandRow>
        </Group>

        {/* Avisos */}
        <Group label="Avisos">
          <ToggleRow icon="notifications-none" title="Notificaciones" sub="Nuevos lugares cerca de ti" value={notifications} onChange={setNotifications} />
          <ToggleRow icon="schedule" title="Solo lugares abiertos" sub="Oculta los cerrados al buscar" value={s.openNow} onChange={(v) => updateSettings({ openNow: v })} last />
        </Group>

        {/* Avanzado */}
        <Group label="Avanzado">
          <ToggleRow icon="code" title="Modo desarrollador" value={s.developerMode} onChange={(v) => updateSettings({ developerMode: v })} last={!s.developerMode} />
          {s.developerMode && (
            <View style={styles.devPanel}>
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
        </Group>

        {/* Privacy */}
        <View style={styles.privacyRow}>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.privacyLink}>Borrar datos locales</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Antojo · Sigue tu antojo · v{appConfig.appVersion}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg, flex: 1 },

  header: { backgroundColor: theme.bgTop, borderBottomColor: theme.line, borderBottomWidth: 1, paddingBottom: 14, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: theme.text },

  content: { paddingTop: 8 },

  identity: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingVertical: 16 },
  avatar: {
    width: 54, height: 54, borderRadius: 99, flexShrink: 0,
    backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 21, fontWeight: "800", color: "#fff" },
  greeting: { fontSize: 17, fontWeight: "800", color: theme.text },
  stats: { fontSize: 13, fontWeight: "600", color: theme.muted, marginTop: 2 },

  locRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 15, paddingHorizontal: 2 },
  locName: { fontSize: 15, fontWeight: "700", color: theme.text },
  locSub: { fontSize: 12.5, fontWeight: "500", color: theme.muted, marginTop: 1 },
  cambiarBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.panel, flexShrink: 0 },
  cambiarText: { fontSize: 13, fontWeight: "700", color: theme.text },

  locPanel: { paddingBottom: 18, paddingHorizontal: 2 },
  gpsBtn: { alignItems: "center", backgroundColor: theme.accent, borderRadius: 99, minHeight: 44, justifyContent: "center", marginBottom: 10 },
  gpsBtnText: { color: theme.onAccent, fontWeight: "900" },
  locInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 999, borderWidth: 1, color: theme.text, minHeight: 46, paddingHorizontal: 16 },
  suggestion: { borderBottomColor: theme.line, borderBottomWidth: 1, paddingVertical: 12 },
  suggestionPrimary: { color: theme.text, fontSize: 15, fontWeight: "800" },
  suggestionSecondary: { color: theme.muted, fontSize: 12.5, marginTop: 3 },

  devPanel: { borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, paddingBottom: 12 },
  devRow: { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", paddingVertical: 10 },
  devKey: { color: theme.muted, fontWeight: "900", width: 88, fontSize: 13 },
  devVal: { color: theme.text, flex: 1, textAlign: "right", fontSize: 13 },

  privacyRow: { alignItems: "center", marginTop: 28, marginBottom: 8 },
  privacyLink: { color: theme.danger, fontSize: 13.5, fontWeight: "700" },

  version: { textAlign: "center", fontSize: 12.5, color: theme.muted2, fontWeight: "600", paddingBottom: 8, marginTop: 4 },
});
