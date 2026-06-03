import React, { useState } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appConfig } from "../config";
import { isFavorite, toggleFavorite } from "../state/store";
import type { Restaurant } from "../types";
import { formatCount } from "../utils/format";
import RestaurantDetailModal from "./RestaurantDetailModal";

function buildDirectionsUrl(restaurant: Restaurant): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}&travelmode=walking`;
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const fav = isFavorite(restaurant.id);
  const [detailOpen, setDetailOpen] = useState(false);

  const photoUrl = restaurant.photoName
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;

  return (
    <View style={styles.card}>
      {photoUrl && (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          <TouchableOpacity onPress={() => toggleFavorite(restaurant.id)} hitSlop={10}>
            <Text style={styles.fav}>{fav ? "❤️" : "🤍"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.area} numberOfLines={1}>{restaurant.area}</Text>

        <View style={styles.meta}>
          {restaurant.distanceKm !== undefined && (
            <Text style={styles.chip}>📍 {restaurant.distanceKm.toFixed(1)} km</Text>
          )}
          {restaurant.rating !== undefined && (
            <Text style={styles.chip}>
              ★ {restaurant.rating.toFixed(1)}
              {restaurant.userRatingCount ? ` (${formatCount(restaurant.userRatingCount)})` : ""}
            </Text>
          )}
          {restaurant.priceLevel && <Text style={styles.chip}>{restaurant.priceLevel}</Text>}
          {restaurant.openNow !== undefined && (
            <Text style={[styles.chip, restaurant.openNow ? styles.open : styles.closed]}>
              {restaurant.openNow ? "Abierto" : "Cerrado"}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={() => setDetailOpen(true)}>
            <Text style={styles.btnText}>Detalles</Text>
          </TouchableOpacity>
          {restaurant.googleMapsUri && (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => void Linking.openURL(restaurant.googleMapsUri!)}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Maps</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => void Linking.openURL(buildDirectionsUrl(restaurant))}
          >
            <Text style={styles.btnText}>Ruta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {detailOpen && (
        <RestaurantDetailModal restaurant={restaurant} onClose={() => setDetailOpen(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  area: { color: "#666", fontSize: 13, marginBottom: 6 },
  body: { padding: 14 },
  btn: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnPrimary: { backgroundColor: "#E8750A" },
  btnText: { color: "#333", fontSize: 13, fontWeight: "600" },
  btnTextPrimary: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    marginBottom: 10,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  chip: {
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 4,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  closed: { backgroundColor: "#FFE0E0", color: "#C00" },
  fav: { fontSize: 20 },
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap" },
  name: { color: "#1A1A1A", flex: 1, fontSize: 16, fontWeight: "700", marginRight: 8 },
  open: { backgroundColor: "#E0F7E0", color: "#070" },
  photo: { height: 160, width: "100%" },
});
