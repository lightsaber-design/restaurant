import React from "react";
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appConfig } from "../config";
import { isFavorite, toggleFavorite } from "../state/store";
import type { Restaurant } from "../types";
import { getDistanceKm } from "../utils/geo";
import { formatCount } from "../utils/format";
import { useAppState } from "../hooks/useAppState";

type Props = { restaurant: Restaurant | null; onClose: () => void };

function buildMapsUrl(restaurant: Restaurant, mode: "search" | "directions" = "search"): string {
  if (restaurant.googleMapsUri && mode === "search") return restaurant.googleMapsUri;
  const dest = `${restaurant.latitude},${restaurant.longitude}`;
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.area}`)}`;
}

export default function RestaurantDetailModal({ restaurant, onClose }: Props) {
  const appState = useAppState();

  if (!restaurant) return null;

  const fav = isFavorite(restaurant.id);
  const distance = getDistanceKm(appState.currentLocation, restaurant);
  const photoUrl = restaurant.photoName
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{restaurant.name}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo */}
          {photoUrl && (
            <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          )}

          {/* Badges */}
          <View style={styles.badges}>
            {restaurant.rating !== undefined && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  ★ {restaurant.rating.toFixed(1)}
                  {restaurant.userRatingCount ? ` (${formatCount(restaurant.userRatingCount)})` : ""}
                </Text>
              </View>
            )}
            {restaurant.priceLevel && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{restaurant.priceLevel}</Text>
              </View>
            )}
            {restaurant.openNow !== undefined && (
              <View style={[styles.badge, restaurant.openNow ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={[styles.badgeText, restaurant.openNow ? styles.badgeOpenText : styles.badgeClosedText]}>
                  {restaurant.openNow ? "Abierto ahora" : "Cerrado ahora"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.area}>{restaurant.area}</Text>
            <Text style={styles.meta}>
              {restaurant.sourceLabel} · A {distance.toFixed(1)} km
            </Text>

            {restaurant.phoneNumber && (
              <TouchableOpacity onPress={() => void Linking.openURL(`tel:${restaurant.phoneNumber}`)}>
                <Text style={styles.link}>📞 {restaurant.phoneNumber}</Text>
              </TouchableOpacity>
            )}
            {restaurant.websiteUri && (
              <TouchableOpacity onPress={() => void Linking.openURL(restaurant.websiteUri!)}>
                <Text style={styles.link}>🌐 Sitio web</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, fav ? styles.btnSaved : styles.btnPrimary]}
              onPress={() => toggleFavorite(restaurant.id)}
            >
              <Text style={styles.btnText}>{fav ? "❤️ Guardado" : "🤍 Guardar"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => void Linking.openURL(buildMapsUrl(restaurant))}
            >
              <Text style={styles.btnText}>📍 Google Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => void Linking.openURL(buildMapsUrl(restaurant, "directions"))}
            >
              <Text style={styles.btnText}>🧭 Ruta a pie</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 16,
  },
  area: {
    color: "#444",
    fontSize: 14,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    marginBottom: 4,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeClosed: { backgroundColor: "#FFE0E0" },
  badgeClosedText: { color: "#C00" },
  badgeOpen: { backgroundColor: "#E0F7E0" },
  badgeOpenText: { color: "#070" },
  badgeText: { color: "#444", fontSize: 13 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  btn: {
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnPrimary: { backgroundColor: "#E8750A" },
  btnSaved: { backgroundColor: "#FFE4E4" },
  btnText: { color: "#1A1A1A", fontSize: 13, fontWeight: "600" },
  closeBtn: {
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
  },
  closeBtnText: { color: "#333", fontSize: 14, fontWeight: "700" },
  container: { backgroundColor: "#fff", flex: 1 },
  header: {
    alignItems: "center",
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  info: { paddingHorizontal: 16, paddingTop: 8 },
  link: { color: "#E8750A", fontSize: 14, marginTop: 8 },
  meta: { color: "#888", fontSize: 13 },
  photo: { height: 220, width: "100%" },
  title: { color: "#1A1A1A", flex: 1, fontSize: 20, fontWeight: "800", marginRight: 12 },
});
