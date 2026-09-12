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

function priceLevelLabel(level?: string): string {
  if (!level) return "";
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Gratis",
    PRICE_LEVEL_INEXPENSIVE: "€",
    PRICE_LEVEL_MODERATE: "€€",
    PRICE_LEVEL_EXPENSIVE: "€€€",
    PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
  };
  return map[level] ?? level;
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { favorites, selectedRestaurantId } = useAppState();
  const fav = favorites.some((f) => f.id === restaurant.id);
  const selected = restaurant.id === selectedRestaurantId;
  const [detailOpen, setDetailOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const photoUrl = restaurant.photoName && !imgError
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;

  const priceLabel = priceLevelLabel(restaurant.priceLevel);
  const distLabel = `${(restaurant.distanceKm ?? 0).toFixed(1)} km`;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      {/* ── photo ── */}
      <View style={styles.photoWrap}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoFallbackIcon}>🍴</Text>
          </View>
        )}

        {/* gradient overlay */}
        <View style={styles.photoGradient} />

        {/* top-left badge */}
        <View style={styles.photoBadges}>
          <View style={styles.cuisineBadge}>
            <Text style={styles.cuisineBadgeText} numberOfLines={1}>
              {restaurant.matchedFood?.name ?? "Restaurante"}
            </Text>
          </View>
          {(restaurant.distanceKm ?? 1) < 0.5 && (
            <View style={styles.nearBadge}>
              <Text style={styles.nearBadgeText}>🔥 Cerca</Text>
            </View>
          )}
        </View>

        {/* top-right: fav button */}
        <TouchableOpacity
          style={[styles.favBtn, fav && styles.favBtnOn]}
          onPress={() => toggleFavorite(restaurant.id)}
          hitSlop={8}
        >
          <Text style={styles.favBtnIcon}>{fav ? "♥" : "♡"}</Text>
        </TouchableOpacity>

        {/* bottom-left: distance */}
        <View style={styles.distWrap}>
          <Text style={styles.distText}>🚶 {distLabel}</Text>
        </View>
      </View>

      {/* ── info ── */}
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          {restaurant.rating !== undefined && (
            <View style={styles.ratingWrap}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingVal}>{restaurant.rating.toFixed(1)}</Text>
              {restaurant.userRatingCount !== undefined && (
                <Text style={styles.ratingCount}>({formatCount(restaurant.userRatingCount)})</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          {restaurant.openNow !== undefined && (
            <View style={styles.openWrap}>
              <View style={[styles.openDot, restaurant.openNow ? styles.openDotOn : styles.openDotOff]} />
              <Text style={[styles.openText, restaurant.openNow ? styles.openTextOn : styles.openTextOff]}>
                {restaurant.openNow ? "Abierto" : "Cerrado"}
              </Text>
            </View>
          )}
          {restaurant.openNow !== undefined && (priceLabel || restaurant.area) && (
            <Text style={styles.metaSep}>·</Text>
          )}
          {priceLabel !== "" && <Text style={styles.priceText}>{priceLabel}</Text>}
          {priceLabel !== "" && restaurant.area && <Text style={styles.metaSep}>·</Text>}
          {restaurant.area !== "" && (
            <Text style={styles.areaText} numberOfLines={1}>{restaurant.area}</Text>
          )}
        </View>

        {/* ── tags ── */}
        {(restaurant.foods?.length ?? 0) > 0 && (
          <View style={styles.tagsRow}>
            {restaurant.foods.slice(0, 3).map((f) => (
              <View key={f.name} style={styles.tag}>
                <Text style={styles.tagText}>{f.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={() => void Linking.openURL(buildMapsUrl(restaurant))}
        >
          <Text style={styles.actionPrimaryText}>Ver en Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={() => void Linking.openURL(buildMapsUrl(restaurant, "directions"))}
        >
          <Text style={styles.actionSecondaryText}>Ruta 🚶</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={() => { setSelectedRestaurant(restaurant.id); setView("explore"); }}
        >
          <Text style={styles.actionSecondaryText}>Mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={() => setDetailOpen(true)}
        >
          <Text style={styles.actionSecondaryText}>Info</Text>
        </TouchableOpacity>
      </View>

      {detailOpen && <RestaurantDetailModal restaurant={restaurant} onClose={() => setDetailOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#14281a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
  },
  cardSelected: { borderColor: theme.accent },

  // photo
  photoWrap: { height: 168, position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoFallback: {
    width: "100%", height: "100%",
    backgroundColor: "#d1e8d5",
    alignItems: "center", justifyContent: "center",
  },
  photoFallbackIcon: { fontSize: 48 },
  photoGradient: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 80,
    backgroundColor: "transparent",
    // React Native doesn't support CSS gradients — use a semi-transparent layer
    opacity: 0.55,
  },
  photoBadges: {
    position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 8,
  },
  cuisineBadge: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5,
    maxWidth: 160,
  },
  cuisineBadgeText: { fontSize: 13, fontWeight: "800", color: "#15241B" },
  nearBadge: {
    backgroundColor: theme.accent,
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5,
  },
  nearBadgeText: { fontSize: 12.5, fontWeight: "800", color: "#FFFFFF" },
  favBtn: {
    position: "absolute", top: 12, right: 12,
    width: 34, height: 34, borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3,
  },
  favBtnOn: { backgroundColor: "#FF4D6D" },
  favBtnIcon: { fontSize: 17, color: "#15241B", lineHeight: 20 },
  distWrap: {
    position: "absolute", bottom: 10, left: 14,
  },
  distText: { fontSize: 12.5, fontWeight: "700", color: "#FFFFFF" },

  // info
  info: { padding: 14 },
  infoRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  name: { color: theme.text, fontSize: 18.5, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  ratingWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  ratingStar: { fontSize: 13, color: theme.star },
  ratingVal: { fontSize: 13, fontWeight: "700", color: theme.text },
  ratingCount: { fontSize: 12, color: theme.muted2, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  openWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  openDot: { width: 7, height: 7, borderRadius: 99 },
  openDotOn: { backgroundColor: theme.accent },
  openDotOff: { backgroundColor: theme.muted2 },
  openText: { fontSize: 12.5, fontWeight: "600" },
  openTextOn: { color: theme.accent },
  openTextOff: { color: theme.muted },
  metaSep: { color: theme.muted2, fontSize: 12 },
  priceText: { fontSize: 12.5, fontWeight: "700", color: theme.accent },
  areaText: { fontSize: 12.5, color: theme.muted, fontWeight: "600", flexShrink: 1 },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  tag: { backgroundColor: theme.panel2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "600", color: theme.muted },

  // actions
  actions: { flexDirection: "row", gap: 8, padding: 14, paddingTop: 0 },
  actionPrimary: {
    flex: 1, height: 42, borderRadius: 14, backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center",
  },
  actionPrimaryText: { color: theme.onAccent, fontSize: 13.5, fontWeight: "800" },
  actionSecondary: {
    height: 42, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: theme.panel2, alignItems: "center", justifyContent: "center",
  },
  actionSecondaryText: { color: theme.text, fontSize: 13, fontWeight: "700" },
});
