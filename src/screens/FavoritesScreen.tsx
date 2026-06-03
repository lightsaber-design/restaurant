import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "../hooks/useAppState";
import { removeFavorite, state, updateFavorite, updateSettings } from "../state/store";
import type { FavoriteRestaurant } from "../types";
import { getDistanceKm } from "../utils/geo";
import { appConfig } from "../config";

const FAVORITE_LISTS = ["Pendientes", "Cena", "Trabajo", "Cita", "Baratos"];

function buildFavoriteMapsUrl(favorite: FavoriteRestaurant, mode: "search" | "directions" = "search"): string {
  if (favorite.googleMapsUri && mode === "search") return favorite.googleMapsUri;
  const encodedName = encodeURIComponent(`${favorite.name} ${favorite.area}`);
  if (mode === "directions") {
    const dest =
      favorite.latitude != null && favorite.longitude != null
        ? `${favorite.latitude},${favorite.longitude}`
        : encodedName;
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
}

function FavoriteCard({
  item,
  allLists,
  compareMode,
  selected,
  onToggleSelect,
}: {
  item: FavoriteRestaurant;
  allLists: string[];
  compareMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const restaurant = state.activeRestaurants.find((r) => r.id === item.id);
  const distanceLabel = restaurant
    ? `A ${getDistanceKm(state.currentLocation, restaurant).toFixed(1)} km`
    : "Distancia al buscar";

  async function shareFavorite() {
    const url = buildFavoriteMapsUrl(item);
    const text = `${item.name} - ${item.area}`;
    try {
      if (await Share.canShare?.()) {
        await Share.share({ message: `${text}\n${url}`, title: item.name });
      } else {
        await Linking.openURL(url);
      }
    } catch {
      await Linking.openURL(url);
    }
  }

  const editableLists = Array.from(new Set([...FAVORITE_LISTS, ...allLists])).sort();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {compareMode && (
          <TouchableOpacity onPress={onToggleSelect} style={styles.checkbox}>
            <Text style={styles.checkboxText}>{selected ? "☑" : "☐"}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardList}>{item.list || "Pendientes"}</Text>
        </View>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={10}>
          <Text style={styles.expandIcon}>{expanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.cardArea} numberOfLines={1}>{item.area}</Text>
      <Text style={styles.cardDistance}>{distanceLabel}</Text>

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      )}

      {/* Expanded editor */}
      {expanded && (
        <View style={styles.editor}>
          {/* List picker */}
          <Text style={styles.editorLabel}>Lista</Text>
          <View style={styles.listPickerRow}>
            {editableLists.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.listChip, (item.list || "Pendientes") === l && styles.listChipActive]}
                onPress={() => updateFavorite(item.id, { list: l })}
              >
                <Text style={[styles.listChipText, (item.list || "Pendientes") === l && styles.listChipTextActive]}>
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editorLabel}>Nota personal</Text>
          <TextInput
            style={styles.noteInput}
            value={item.note || ""}
            onChangeText={(text) => updateFavorite(item.id, { note: text })}
            placeholder="Ej. probar la burger doble"
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={2}
          />

          <Text style={styles.editorLabel}>Etiquetas (separadas por coma)</Text>
          <TextInput
            style={styles.tagsInput}
            value={(item.tags || []).join(", ")}
            onChangeText={(text) => {
              const tags = text.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
              updateFavorite(item.id, { tags });
            }}
            placeholder="barato, terraza, vegano"
            placeholderTextColor="#aaa"
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {item.googleMapsUri && (
          <TouchableOpacity style={styles.btn} onPress={() => void Linking.openURL(buildFavoriteMapsUrl(item))}>
            <Text style={styles.btnText}>Maps</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btn} onPress={() => void Linking.openURL(buildFavoriteMapsUrl(item, "directions"))}>
          <Text style={styles.btnText}>Ruta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void shareFavorite()}>
          <Text style={styles.btnText}>Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={() =>
            Alert.alert("Quitar favorito", `¿Quitar "${item.name}"?`, [
              { text: "Cancelar", style: "cancel" },
              { text: "Quitar", style: "destructive", onPress: () => removeFavorite(item.id) },
            ])
          }
        >
          <Text style={[styles.btnText, styles.btnDangerText]}>Quitar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CompareModal({
  favorites,
  onClose,
}: {
  favorites: FavoriteRestaurant[];
  onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.compareContainer}>
        <View style={styles.compareHeader}>
          <Text style={styles.compareTitle}>Comparar favoritos</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.compareContent}>
          {favorites.map((fav) => {
            const restaurant = state.activeRestaurants.find((r) => r.id === fav.id);
            const distance = restaurant
              ? `${getDistanceKm(state.currentLocation, restaurant).toFixed(1)} km`
              : "Busca para ver";
            return (
              <View key={fav.id} style={styles.compareCard}>
                <Text style={styles.compareName}>{fav.name}</Text>
                <Text style={styles.compareMeta}>📍 {distance}</Text>
                <Text style={styles.compareMeta}>📋 {fav.list || "Pendientes"}</Text>
                {fav.tags && fav.tags.length > 0 && (
                  <Text style={styles.compareMeta}>🏷 {fav.tags.join(", ")}</Text>
                )}
                {fav.note ? <Text style={styles.compareMeta}>📝 {fav.note}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function FavoritesScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const allLists = Array.from(new Set(appState.favorites.map((f) => f.list || "Pendientes"))).sort();

  function getVisibleFavorites() {
    const listFilter = appState.settings.favoriteListFilter;
    return appState.favorites
      .filter((fav) => {
        if (listFilter !== "all" && (fav.list || "Pendientes") !== listFilter) return false;
        if (!appState.settings.favoriteNearOnly) return true;
        const r = state.activeRestaurants.find((item) => item.id === fav.id);
        return r ? getDistanceKm(state.currentLocation, r) <= 5 : false;
      })
      .sort((a, b) => {
        const mode = appState.settings.favoriteSortMode;
        if (mode === "name") return a.name.localeCompare(b.name);
        if (mode === "list") return (a.list || "Pendientes").localeCompare(b.list || "Pendientes");
        if (mode === "distance") {
          const rA = state.activeRestaurants.find((r) => r.id === a.id);
          const rB = state.activeRestaurants.find((r) => r.id === b.id);
          const dA = rA ? getDistanceKm(state.currentLocation, rA) : Infinity;
          const dB = rB ? getDistanceKm(state.currentLocation, rB) : Infinity;
          return dA - dB;
        }
        return Date.parse(b.savedAt) - Date.parse(a.savedAt);
      });
  }

  function exportBackup() {
    const backup = JSON.stringify({ exportedAt: new Date().toISOString(), favorites: appState.favorites, version: appConfig.appVersion }, null, 2);
    void Share.share({ message: backup, title: "SavvyFoodie backup" });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 3) next.add(id);
      return next;
    });
  }

  const visible = getVisibleFavorites();
  const compareItems = appState.favorites.filter((f) => selectedIds.has(f.id));

  const listFilterOptions = [{ label: "Todas", value: "all" }, ...allLists.map((l) => ({ label: l, value: l }))];
  const sortOptions = [
    { label: "Recientes", value: "recent" },
    { label: "Distancia", value: "distance" },
    { label: "Nombre", value: "name" },
    { label: "Lista", value: "list" },
  ] as const;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>❤️ Favoritos</Text>
        <Text style={styles.count}>{appState.favorites.length} guardados</Text>
      </View>

      {appState.favorites.length > 0 && (
        <>
          {/* Toolbar */}
          <View style={styles.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
              {/* List filter */}
              {listFilterOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.toolChip, appState.settings.favoriteListFilter === opt.value && styles.toolChipActive]}
                  onPress={() => updateSettings({ favoriteListFilter: opt.value })}
                >
                  <Text style={[styles.toolChipText, appState.settings.favoriteListFilter === opt.value && styles.toolChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Sort + near-only */}
          <View style={styles.sortRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
              {sortOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortChip, appState.settings.favoriteSortMode === opt.value && styles.sortChipActive]}
                  onPress={() => updateSettings({ favoriteSortMode: opt.value })}
                >
                  <Text style={[styles.sortChipText, appState.settings.favoriteSortMode === opt.value && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.nearRow}>
              <Text style={styles.nearLabel}>Solo cerca</Text>
              <Switch
                value={appState.settings.favoriteNearOnly}
                onValueChange={(v) => updateSettings({ favoriteNearOnly: v })}
                trackColor={{ true: "#E8750A" }}
              />
            </View>
          </View>

          {/* Actions bar */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={[styles.actionBarBtn, compareMode && styles.actionBarBtnActive]}
              onPress={() => { setCompareMode((v) => !v); setSelectedIds(new Set()); }}
            >
              <Text style={[styles.actionBarBtnText, compareMode && styles.actionBarBtnTextActive]}>
                {compareMode ? "Cancelar" : "Comparar"}
              </Text>
            </TouchableOpacity>
            {compareMode && selectedIds.size >= 2 && (
              <TouchableOpacity style={[styles.actionBarBtn, styles.actionBarBtnActive]} onPress={() => setCompareOpen(true)}>
                <Text style={[styles.actionBarBtnText, styles.actionBarBtnTextActive]}>Ver comparativa ({selectedIds.size})</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBarBtn} onPress={exportBackup}>
              <Text style={styles.actionBarBtnText}>Exportar backup</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {appState.favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🍽</Text>
          <Text style={styles.emptyText}>Aún no tienes favoritos.</Text>
          <Text style={styles.emptyHint}>Busca restaurantes y pulsa ❤️ para guardarlos aquí.</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay favoritos con este filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FavoriteCard
              item={item}
              allLists={allLists}
              compareMode={compareMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {compareOpen && <CompareModal favorites={compareItems} onClose={() => setCompareOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBarBtn: { backgroundColor: "#F0F0F0", borderRadius: 8, marginRight: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionBarBtnActive: { backgroundColor: "#E8750A" },
  actionBarBtnText: { color: "#444", fontSize: 13, fontWeight: "600" },
  actionBarBtnTextActive: { color: "#fff" },
  actionsBar: { flexDirection: "row", paddingBottom: 8, paddingHorizontal: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  btn: { backgroundColor: "#F0F0F0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnDanger: { backgroundColor: "#FFE0E0" },
  btnDangerText: { color: "#C00" },
  btnText: { color: "#333", fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, elevation: 2, marginBottom: 10, marginHorizontal: 16, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  cardArea: { color: "#666", fontSize: 13, marginBottom: 2 },
  cardDistance: { color: "#888", fontSize: 12, marginBottom: 6 },
  cardHeader: { alignItems: "center", flexDirection: "row", marginBottom: 2 },
  cardList: { color: "#E8750A", fontSize: 12, fontWeight: "600" },
  cardName: { color: "#1A1A1A", flex: 1, fontSize: 16, fontWeight: "700" },
  cardTitleGroup: { flex: 1, marginRight: 8 },
  checkbox: { marginRight: 10 },
  checkboxText: { color: "#E8750A", fontSize: 22 },
  closeBtnText: { color: "#333", fontSize: 18, fontWeight: "700", padding: 4 },
  compareCard: { backgroundColor: "#F5F5F5", borderRadius: 10, marginBottom: 12, padding: 14 },
  compareContainer: { backgroundColor: "#fff", flex: 1 },
  compareContent: { padding: 16 },
  compareHeader: { alignItems: "center", borderBottomColor: "#eee", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  compareMeta: { color: "#555", fontSize: 14, marginTop: 4 },
  compareName: { color: "#1A1A1A", fontSize: 16, fontWeight: "700" },
  compareTitle: { fontSize: 18, fontWeight: "800" },
  count: { color: "#fff", fontSize: 13, opacity: 0.8 },
  editor: { borderTopColor: "#F0F0F0", borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  editorLabel: { color: "#888", fontSize: 12, fontWeight: "700", marginBottom: 4, marginTop: 8, textTransform: "uppercase" },
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  emptyHint: { color: "#888", fontSize: 14, marginTop: 8, textAlign: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#444", fontSize: 18, fontWeight: "600", textAlign: "center" },
  expandIcon: { color: "#aaa", fontSize: 14, padding: 4 },
  header: { backgroundColor: "#1A1A1A", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  list: { paddingBottom: 20, paddingTop: 8 },
  listChip: { backgroundColor: "#F0F0F0", borderRadius: 8, marginBottom: 4, marginRight: 6, paddingHorizontal: 10, paddingVertical: 5 },
  listChipActive: { backgroundColor: "#E8750A" },
  listChipText: { color: "#555", fontSize: 12 },
  listChipTextActive: { color: "#fff" },
  listPickerRow: { flexDirection: "row", flexWrap: "wrap" },
  nearLabel: { color: "#444", fontSize: 13, marginRight: 8 },
  nearRow: { alignItems: "center", flexDirection: "row", marginLeft: "auto", paddingRight: 4 },
  noteInput: { backgroundColor: "#F5F5F5", borderRadius: 8, fontSize: 14, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: "top" },
  screen: { backgroundColor: "#F5F5F5", flex: 1 },
  sortChip: { backgroundColor: "#F0F0F0", borderRadius: 8, marginRight: 6, paddingHorizontal: 12, paddingVertical: 5 },
  sortChipActive: { backgroundColor: "#1A1A1A" },
  sortChipText: { color: "#555", fontSize: 12 },
  sortChipTextActive: { color: "#fff" },
  sortRow: { alignItems: "center", flexDirection: "row", paddingBottom: 6, paddingHorizontal: 16 },
  tag: { backgroundColor: "#FFF3E0", borderRadius: 6, color: "#E8750A", fontSize: 11, marginBottom: 4, marginRight: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  tagsInput: { backgroundColor: "#F5F5F5", borderRadius: 8, fontSize: 14, paddingHorizontal: 12, paddingVertical: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  toolChip: { backgroundColor: "#F0F0F0", borderRadius: 8, marginRight: 6, paddingHorizontal: 12, paddingVertical: 6 },
  toolChipActive: { backgroundColor: "#E8750A" },
  toolChipText: { color: "#555", fontSize: 13 },
  toolChipTextActive: { color: "#fff" },
  toolbar: { paddingBottom: 4, paddingTop: 10 },
  toolbarScroll: { paddingHorizontal: 16 },
});
