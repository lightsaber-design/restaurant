import React, { useState } from "react";
import {
  Alert,
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
import { removeCategory, removeFavorite, saveCategory, triggerSearch, updateFavorite, updateSettings } from "../state/store";
import { CATEGORIES, MORE_CATEGORIES, theme } from "../theme";
import type { FavoriteRestaurant } from "../types";
import { getDistanceKm } from "../utils/geo";
import { appConfig } from "../config";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFavoriteMapsUrl(fav: FavoriteRestaurant, mode: "search" | "directions" = "search"): string {
  if (fav.googleMapsUri && mode === "search") return fav.googleMapsUri;
  const encodedName = encodeURIComponent(`${fav.name} ${fav.area}`);
  if (mode === "directions") {
    const dest = fav.latitude != null && fav.longitude != null ? `${fav.latitude},${fav.longitude}` : encodedName;
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
}

// ── Modal para añadir categorías ─────────────────────────────────────────────

function AddCategoryModal({ saved, onClose }: { saved: string[]; onClose: () => void }) {
  const [customText, setCustomText] = useState("");

  function add(dish: string) {
    saveCategory(dish);
  }

  function addCustom() {
    const val = customText.trim();
    if (!val) return;
    saveCategory(val);
    setCustomText("");
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.addCatDialog}>
          <View style={styles.addCatHead}>
            <Text style={styles.addCatTitle}>Añadir categoría</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.addCatClose}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Categorías principales */}
            <Text style={styles.addCatSection}>Principales</Text>
            <View style={styles.addCatGrid}>
              {CATEGORIES.map((cat) => {
                const already = saved.includes(cat.dish);
                return (
                  <TouchableOpacity
                    key={cat.dish}
                    style={[styles.addCatItem, already && styles.addCatItemSaved]}
                    onPress={() => already ? removeCategory(cat.dish) : add(cat.dish)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addCatEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.addCatLabel, already && styles.addCatLabelSaved]}>{cat.label}</Text>
                    {already && <Text style={styles.addCatCheck}>★</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Más categorías */}
            <Text style={styles.addCatSection}>Más opciones</Text>
            <View style={styles.addCatPills}>
              {MORE_CATEGORIES.map((cat) => {
                const already = saved.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.addCatPill, already && styles.addCatPillSaved]}
                    onPress={() => already ? removeCategory(cat) : add(cat)}
                  >
                    <Text style={[styles.addCatPillText, already && styles.addCatPillTextSaved]}>
                      {already ? "★ " : ""}{cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Categoría personalizada */}
            <Text style={styles.addCatSection}>Personalizada</Text>
            <View style={styles.addCatCustomRow}>
              <TextInput
                style={styles.addCatInput}
                value={customText}
                onChangeText={setCustomText}
                onSubmitEditing={addCustom}
                placeholder="Ej. kebab, crepes, tapas…"
                placeholderTextColor={theme.muted2}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addCatBtn} onPress={addCustom}>
                <Text style={styles.addCatBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Sección de categorías guardadas ──────────────────────────────────────────

function SavedCategoriesSection({ saved }: { saved: string[] }) {
  const [addOpen, setAddOpen] = useState(false);

  function getCatEmoji(dish: string): string | null {
    return CATEGORIES.find((c) => c.dish === dish)?.emoji ?? null;
  }

  return (
    <View style={styles.catSection}>
      <View style={styles.catSectionHead}>
        <Text style={styles.catSectionTitle}>Mis categorías</Text>
        <TouchableOpacity style={styles.addCatOpenBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addCatOpenBtnText}>+ Añadir</Text>
        </TouchableOpacity>
      </View>

      {saved.length === 0 ? (
        <TouchableOpacity style={styles.catEmpty} onPress={() => setAddOpen(true)} activeOpacity={0.7}>
          <Text style={styles.catEmptyText}>Añade categorías para buscar rápido ✦</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.catChips}>
          {saved.map((cat) => (
            <View key={cat} style={styles.catChip}>
              <TouchableOpacity style={styles.catChipLabel} onPress={() => triggerSearch(cat)}>
                <Text style={styles.catChipText}>
                  {getCatEmoji(cat) ? `${getCatEmoji(cat)} ` : "★ "}
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeCategory(cat)} hitSlop={8} style={styles.catChipRemove}>
                <Text style={styles.catChipRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.catChipAdd} onPress={() => setAddOpen(true)}>
            <Text style={styles.catChipAddText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {addOpen && <AddCategoryModal saved={saved} onClose={() => setAddOpen(false)} />}
    </View>
  );
}

// ── Tarjeta de favorito ───────────────────────────────────────────────────────

function FavoriteCard({
  item, allLists, compareMode, selected, onToggleSelect,
}: {
  item: FavoriteRestaurant; allLists: string[]; compareMode: boolean; selected: boolean; onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note ?? "");
  const [tagsDraft, setTagsDraft] = useState((item.tags ?? []).join(", "));
  const [newListDraft, setNewListDraft] = useState("");
  const { activeRestaurants, currentLocation } = useAppState();
  const restaurant = activeRestaurants.find((r) => r.id === item.id);
  const distanceLabel = restaurant ? `A ${getDistanceKm(currentLocation, restaurant).toFixed(1)} km` : "Distancia al buscar";

  async function shareFavorite() {
    const url = buildFavoriteMapsUrl(item);
    try { await Share.share({ message: `${item.name} - ${item.area}\n${url}`, title: item.name }); }
    catch { await Linking.openURL(url); }
  }

  function createAndAssignList() {
    const name = newListDraft.trim();
    if (!name) return;
    updateFavorite(item.id, { list: name });
    setNewListDraft("");
  }

  const editableLists = allLists.length > 0 ? allLists : [item.list || "Pendientes"];

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {compareMode && (
          <TouchableOpacity onPress={onToggleSelect} style={styles.check}>
            <Text style={styles.checkText}>{selected ? "☑" : "☐"}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleGroup}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.statusPill}><Text style={styles.statusText}>{item.list || "Pendientes"}</Text></View>
        </View>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={10}>
          <Text style={styles.expand}>{expanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.area} numberOfLines={1}>{item.area}</Text>
      <Text style={styles.distance}>{distanceLabel}</Text>

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((t) => <Text key={t} style={styles.tag}>{t}</Text>)}
        </View>
      )}

      {expanded && (
        <View style={styles.editor}>
          <Text style={styles.editorLabel}>Lista</Text>
          <View style={styles.listPicker}>
            {editableLists.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.listChip, (item.list || "Pendientes") === l && styles.listChipActive]}
                onPress={() => updateFavorite(item.id, { list: l })}
              >
                <Text style={[styles.listChipText, (item.list || "Pendientes") === l && styles.listChipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.newListRow}>
            <TextInput
              style={styles.newListInput}
              value={newListDraft}
              onChangeText={setNewListDraft}
              onSubmitEditing={createAndAssignList}
              placeholder="Nueva lista…"
              placeholderTextColor={theme.muted2}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.newListBtn} onPress={createAndAssignList}>
              <Text style={styles.newListBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.editorLabel}>Nota personal</Text>
          <TextInput
            style={styles.noteInput}
            value={noteDraft}
            onChangeText={setNoteDraft}
            onBlur={() => updateFavorite(item.id, { note: noteDraft })}
            placeholder="Ej. probar la burger doble"
            placeholderTextColor={theme.muted2}
            multiline
          />

          <Text style={styles.editorLabel}>Etiquetas (coma)</Text>
          <TextInput
            style={styles.tagsInput}
            value={tagsDraft}
            onChangeText={setTagsDraft}
            onBlur={() => updateFavorite(item.id, { tags: tagsDraft.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8) })}
            placeholder="barato, terraza, vegano"
            placeholderTextColor={theme.muted2}
          />
        </View>
      )}

      <View style={styles.actions}>
        {item.googleMapsUri && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => void Linking.openURL(buildFavoriteMapsUrl(item))}>
            <Text style={styles.actionText}>Maps</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={() => void Linking.openURL(buildFavoriteMapsUrl(item, "directions"))}>
          <Text style={styles.actionText}>Ruta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => void shareFavorite()}>
          <Text style={styles.actionText}>Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionDanger]}
          onPress={() => Alert.alert("Quitar favorito", `¿Quitar "${item.name}"?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Quitar", style: "destructive", onPress: () => removeFavorite(item.id) },
          ])}
        >
          <Text style={styles.actionDangerText}>Quitar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Modal de comparación ──────────────────────────────────────────────────────

function CompareModal({ favorites, onClose }: { favorites: FavoriteRestaurant[]; onClose: () => void }) {
  const { activeRestaurants, currentLocation } = useAppState();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.compareDialog}>
          <View style={styles.compareHead}>
            <Text style={styles.compareTitle}>Comparar favoritos</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={styles.compareClose}>×</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {favorites.map((fav) => {
              const r = activeRestaurants.find((x) => x.id === fav.id);
              const dist = r ? `${getDistanceKm(currentLocation, r).toFixed(1)} km` : "Busca para ver";
              return (
                <View key={fav.id} style={styles.compareCard}>
                  <Text style={styles.compareName}>{fav.name}</Text>
                  <Text style={styles.compareMeta}>📍 {dist}</Text>
                  <Text style={styles.compareMeta}>📋 {fav.list || "Pendientes"}</Text>
                  {fav.tags && fav.tags.length > 0 && <Text style={styles.compareMeta}>🏷 {fav.tags.join(", ")}</Text>}
                  {fav.note ? <Text style={styles.compareMeta}>📝 {fav.note}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

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
        const r = appState.activeRestaurants.find((x) => x.id === fav.id);
        return r ? getDistanceKm(appState.currentLocation, r) <= 5 : false;
      })
      .sort((a, b) => {
        const mode = appState.settings.favoriteSortMode;
        if (mode === "name") return a.name.localeCompare(b.name);
        if (mode === "list") return (a.list || "Pendientes").localeCompare(b.list || "Pendientes");
        if (mode === "distance") {
          const rA = appState.activeRestaurants.find((r) => r.id === a.id);
          const rB = appState.activeRestaurants.find((r) => r.id === b.id);
          const dA = rA ? getDistanceKm(appState.currentLocation, rA) : Infinity;
          const dB = rB ? getDistanceKm(appState.currentLocation, rB) : Infinity;
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
    { label: "Recientes", value: "recent" }, { label: "Distancia", value: "distance" },
    { label: "Nombre", value: "name" }, { label: "Lista", value: "list" },
  ] as const;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Favoritos</Text>
        <View style={styles.countPill}><Text style={styles.countText}>{appState.favorites.length}</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Categorías guardadas ── */}
        <SavedCategoriesSection saved={appState.savedCategories} />

        {/* ── Controles de lista ── */}
        {appState.favorites.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolScroll}>
              <View style={styles.toolRow}>
                {listFilterOptions.map((o) => (
                  <TouchableOpacity
                    key={o.value}
                    style={[styles.toolChip, appState.settings.favoriteListFilter === o.value && styles.toolChipActive]}
                    onPress={() => updateSettings({ favoriteListFilter: o.value })}
                  >
                    <Text style={[styles.toolChipText, appState.settings.favoriteListFilter === o.value && styles.toolChipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.sortRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.toolRow}>
                  {sortOptions.map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.sortChip, appState.settings.favoriteSortMode === o.value && styles.sortChipActive]}
                      onPress={() => updateSettings({ favoriteSortMode: o.value })}
                    >
                      <Text style={[styles.sortChipText, appState.settings.favoriteSortMode === o.value && styles.sortChipTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.nearRow}>
              <Text style={styles.nearLabel}>Solo cerca (5 km)</Text>
              <Switch
                value={appState.settings.favoriteNearOnly}
                onValueChange={(v) => updateSettings({ favoriteNearOnly: v })}
                trackColor={{ true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.barRow}>
              <TouchableOpacity
                style={[styles.barBtn, compareMode && styles.barBtnActive]}
                onPress={() => { setCompareMode((v) => !v); setSelectedIds(new Set()); }}
              >
                <Text style={[styles.barBtnText, compareMode && styles.barBtnTextActive]}>{compareMode ? "Cancelar" : "Comparar"}</Text>
              </TouchableOpacity>
              {compareMode && selectedIds.size >= 2 && (
                <TouchableOpacity style={[styles.barBtn, styles.barBtnActive]} onPress={() => setCompareOpen(true)}>
                  <Text style={[styles.barBtnText, styles.barBtnTextActive]}>Ver ({selectedIds.size})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.barBtn} onPress={exportBackup}>
                <Text style={styles.barBtnText}>Exportar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Lista de favoritos ── */}
        {appState.favorites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aún no tienes favoritos</Text>
            <Text style={styles.emptyText}>Guarda restaurantes desde los resultados para crear listas, notas y comparativas.</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No hay favoritos con ese filtro</Text>
            <Text style={styles.emptyText}>Cambia la lista o desactiva "Solo cerca".</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((item) => (
              <FavoriteCard
                key={item.id}
                item={item}
                allLists={allLists}
                compareMode={compareMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {compareOpen && <CompareModal favorites={compareItems} onClose={() => setCompareOpen(false)} />}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Favoritos card
  actionBtn: { alignItems: "center", borderColor: theme.line, borderRadius: 999, borderWidth: 1, flexGrow: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 14 },
  actionDanger: { borderColor: theme.dangerBorder, backgroundColor: theme.dangerBg },
  actionDangerText: { color: theme.danger, fontSize: 13, fontWeight: "900" },
  actionText: { color: theme.text, fontSize: 13, fontWeight: "900" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  area: { color: theme.muted, fontSize: 14 },
  barBtn: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  barBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  barBtnText: { color: theme.text, fontSize: 13, fontWeight: "900" },
  barBtnTextActive: { color: "#111015" },
  barRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  card: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderWidth: 1, padding: 16 },
  cardHead: { alignItems: "center", flexDirection: "row", marginBottom: 4 },
  check: { marginRight: 10 },
  checkText: { color: theme.accent, fontSize: 22 },

  // Modal de añadir categorías
  addCatBtn: { alignItems: "center", backgroundColor: theme.accent, borderRadius: 12, height: 46, justifyContent: "center", width: 46 },
  addCatBtnText: { color: "#111015", fontSize: 24, fontWeight: "900" },
  addCatCheck: { color: theme.accent, fontSize: 14, marginTop: 2 },
  addCatClose: { color: theme.text, fontSize: 28, lineHeight: 32 },
  addCatCustomRow: { flexDirection: "row", gap: 10, paddingHorizontal: 2 },
  addCatDialog: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 24, borderWidth: 1, maxHeight: "88%", padding: 20, width: "100%" },
  addCatEmoji: { fontSize: 28, marginBottom: 6 },
  addCatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  addCatHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  addCatInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 14, borderWidth: 1, color: theme.text, flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  addCatItem: {
    alignItems: "center",
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: "22%",
    flex: 1,
    padding: 12,
  },
  addCatItemSaved: { backgroundColor: theme.accentChipBg, borderColor: theme.accent },
  addCatLabel: { color: theme.muted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  addCatLabelSaved: { color: theme.accentChipText, fontWeight: "800" },
  addCatPill: {
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addCatPillSaved: { backgroundColor: theme.accentChipBg, borderColor: theme.accent },
  addCatPillText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  addCatPillTextSaved: { color: theme.accentChipText },
  addCatPills: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  addCatSection: { color: theme.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12, marginTop: 16, textTransform: "uppercase" },
  addCatTitle: { color: theme.text, fontSize: 20, fontWeight: "800" },

  // Sección de categorías guardadas
  catChip: {
    alignItems: "center",
    backgroundColor: theme.accentChipBg,
    borderColor: "rgba(169,133,255,0.35)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    marginRight: 8,
    overflow: "hidden",
  },
  catChipAdd: {
    alignItems: "center",
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginBottom: 8,
    width: 36,
  },
  catChipAddText: { color: theme.muted, fontSize: 20, fontWeight: "700" },
  catChipLabel: { paddingHorizontal: 12, paddingVertical: 8 },
  catChipRemove: { borderLeftColor: "rgba(169,133,255,0.25)", borderLeftWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  catChipRemoveText: { color: theme.accentChipText, fontSize: 16, fontWeight: "700" },
  catChipText: { color: theme.accentChipText, fontSize: 13, fontWeight: "800" },
  catChips: { flexDirection: "row", flexWrap: "wrap" },
  catEmpty: {
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    padding: 14,
  },
  catEmptyText: { color: theme.muted, fontSize: 14, textAlign: "center" },
  catSection: {
    backgroundColor: theme.panel,
    borderColor: theme.line,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  catSectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  catSectionTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
  addCatOpenBtn: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  addCatOpenBtnText: { color: "#111015", fontSize: 13, fontWeight: "900" },

  // Compare
  compareCard: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 14 },
  compareClose: { color: theme.text, fontSize: 26 },
  compareDialog: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderWidth: 1, maxHeight: "85%", padding: 20, width: "100%" },
  compareHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  compareMeta: { color: theme.muted, fontSize: 14, marginTop: 4 },
  compareName: { color: theme.text, fontSize: 16, fontWeight: "800" },
  compareTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },

  // Layout
  content: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 16 },
  countPill: { backgroundColor: theme.accentChipBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  countText: { color: theme.accentChipText, fontSize: 13, fontWeight: "900" },
  distance: { color: theme.muted2, fontSize: 13, marginBottom: 6, marginTop: 2 },
  editor: { borderTopColor: theme.line, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  editorLabel: { color: theme.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 7, marginTop: 10 },
  empty: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderStyle: "dashed", borderWidth: 1, padding: 22 },
  emptyText: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  expand: { color: theme.muted2, fontSize: 14, padding: 4 },
  header: { alignItems: "center", backgroundColor: "rgba(8, 9, 13, 0.98)", borderBottomColor: theme.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 14, paddingHorizontal: 16 },
  list: { gap: 14 },
  listChip: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  listChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  listChipText: { color: theme.text, fontSize: 12.5 },
  listChipTextActive: { color: "#111015", fontWeight: "800" },
  listPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  name: { color: theme.text, flex: 1, fontSize: 16, fontWeight: "800" },
  nearLabel: { color: theme.muted, fontSize: 14, fontWeight: "800" },
  nearRow: { alignItems: "center", backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 14 },
  newListBtn: { alignItems: "center", backgroundColor: theme.accent, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  newListBtnText: { color: "#111015", fontSize: 22, fontWeight: "900" },
  newListInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 12, borderWidth: 1, color: theme.text, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  newListRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  noteInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 14, borderWidth: 1, color: theme.text, paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: "top" },
  overlay: { backgroundColor: "rgba(0,0,0,0.75)", flex: 1, justifyContent: "center", padding: 16 },
  screen: { backgroundColor: theme.bg, flex: 1 },
  sortChip: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 999, borderWidth: 1, marginRight: 6, paddingHorizontal: 14, paddingVertical: 8 },
  sortChipActive: { backgroundColor: theme.accent2, borderColor: theme.accent2 },
  sortChipText: { color: theme.text, fontSize: 12.5, fontWeight: "700" },
  sortChipTextActive: { color: "#fff" },
  sortRow: { marginBottom: 12 },
  statusPill: { backgroundColor: theme.successBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: theme.success, fontSize: 12, fontWeight: "900" },
  tag: { borderColor: "rgba(169, 133, 255, 0.35)", borderRadius: 999, borderWidth: 1, color: theme.accentChipText, fontSize: 12, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tagsInput: { backgroundColor: theme.inputBg, borderColor: theme.line, borderRadius: 14, borderWidth: 1, color: theme.text, paddingHorizontal: 12, paddingVertical: 11 },
  title: { color: theme.text, fontSize: 24, fontWeight: "800" },
  titleGroup: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, marginRight: 8 },
  toolChip: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 999, borderWidth: 1, marginRight: 6, paddingHorizontal: 14, paddingVertical: 9 },
  toolChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  toolChipText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  toolChipTextActive: { color: "#111015" },
  toolRow: { flexDirection: "row" },
  toolScroll: { marginBottom: 12 },
});
