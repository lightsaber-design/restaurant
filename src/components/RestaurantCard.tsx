import React, { useState } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appConfig } from "../config";
import { setSelectedRestaurant, setView, toggleFavorite } from "../state/store";
import { useAppState } from "../hooks/useAppState";
import { theme } from "../theme";
import type { Restaurant } from "../types";
import { formatCount } from "../utils/format";
import RestaurantDetailModal from "./RestaurantDetailModal";

function buildMapsUrl(r: Restaurant, mode: "search" | "directions" = "search"): string {
  if (r.googleMapsUri && mode === "search") return r.googleMapsUri;
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.area}`)}`;
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { favorites, selectedRestaurantId } = useAppState();
  const fav = favorites.some((f) => f.id === restaurant.id);
  const selected = restaurant.id === selectedRestaurantId;
  const [detailOpen, setDetailOpen] = useState(false);

  const photoUrl = restaurant.photoName
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;
  const priceDisplay = restaurant.priceRange ?? restaurant.priceLevel ?? "Ver en Maps";

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      {/* fila principal: info izquierda + precio/foto derecha */}
      <View style={styles.topRow}>
        <View style={styles.info}>
          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={2}>{restaurant.name}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Google Places</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{restaurant.area}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>A {(restaurant.distanceKm ?? 0).toFixed(1)} km</Text>
            {restaurant.rating !== undefined && (
              <Text style={styles.meta}>
                ★ {restaurant.rating.toFixed(1)}
                {restaurant.userRatingCount ? ` (${formatCount(restaurant.userRatingCount)})` : ""}
              </Text>
            )}
            {restaurant.openNow !== undefined && (
              <Text style={[styles.badge, restaurant.openNow ? styles.badgeOpen : styles.badgeClosed]}>
                {restaurant.openNow ? "Abierto" : "Cerrado"}
              </Text>
            )}
          </View>
          <Text style={styles.dishLine} numberOfLines={1}>
            {restaurant.matchedFood?.name || "Comida cercana"}
          </Text>
        </View>

        <View style={styles.priceBox}>
          {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />}
          <Text style={styles.price}>{priceDisplay}</Text>
          <Text style={styles.booking}>Ver en Maps</Text>
        </View>
      </View>

      {/* acciones */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setSelectedRestaurant(restaurant.id); setView("explore"); }}
        >
          <Text style={styles.actionText}>Ver en mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setDetailOpen(true)}>
          <Text style={styles.actionText}>Detalles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, fav && styles.actionBtnSaved]}
          onPress={() => toggleFavorite(restaurant.id)}
        >
          <Text style={[styles.actionText, fav && styles.actionTextSaved]}>{fav ? "Guardado" : "Guardar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionAccent]} onPress={() => void Linking.openURL(buildMapsUrl(restaurant))}>
          <Text style={styles.actionAccentText}>Google Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionAccent]} onPress={() => void Linking.openURL(buildMapsUrl(restaurant, "directions"))}>
          <Text style={styles.actionAccentText}>Ruta</Text>
        </TouchableOpacity>
      </View>

      {detailOpen && <RestaurantDetailModal restaurant={restaurant} onClose={() => setDetailOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  actionAccent: { backgroundColor: theme.accent, borderColor: theme.accent },
  actionAccentText: { color: "#111015", fontSize: 13, fontWeight: "900" },
  actionBtn: {
    alignItems: "center",
    borderColor: theme.line,
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  actionBtnSaved: { borderColor: theme.accent },
  actionText: { color: theme.text, fontSize: 13, fontWeight: "900" },
  actionTextSaved: { color: theme.accent },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  badge: { borderRadius: 999, fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3 },
  badgeClosed: { backgroundColor: "rgba(255, 118, 118, 0.14)", color: theme.danger },
  badgeOpen: { backgroundColor: theme.successBg, color: theme.success },
  booking: { color: theme.muted, fontSize: 12 },
  card: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderWidth: 1, padding: 16 },
  cardSelected: { borderColor: "rgba(169, 133, 255, 0.7)" },
  dishLine: { color: theme.muted, fontSize: 14, marginTop: 2 },
  info: { flex: 1, minWidth: 0 },
  meta: { color: theme.muted, fontSize: 14 },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  name: { color: theme.text, flex: 1, fontSize: 17, fontWeight: "800", marginRight: 8 },
  photo: { borderColor: theme.line, borderRadius: 12, borderWidth: 1, height: 72, marginBottom: 8, width: 72 },
  price: { color: theme.accent, fontSize: 20, fontWeight: "900", marginBottom: 4 },
  priceBox: { alignItems: "flex-end", marginLeft: 12, minWidth: 88 },
  statusPill: { alignSelf: "flex-start", backgroundColor: theme.successBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { color: theme.success, fontSize: 12, fontWeight: "900" },
  titleBlock: { gap: 8, marginBottom: 10 },
  topRow: { flexDirection: "row" },
});
