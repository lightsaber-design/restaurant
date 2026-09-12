import React from "react";
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appConfig } from "../config";
import { toggleFavorite } from "../state/store";
import { useAppState } from "../hooks/useAppState";
import { theme } from "../theme";
import { Icon } from "./Icon";
import type { Restaurant } from "../types";
import { getDistanceKm } from "../utils/geo";
import { formatCount } from "../utils/format";

type Props = { restaurant: Restaurant | null; onClose: () => void };

function priceLevelLabel(pl?: string) {
  if (!pl) return "";
  if (pl.includes("VERY_EXPENSIVE")) return "€€€€";
  if (pl.includes("EXPENSIVE")) return "€€€";
  if (pl.includes("MODERATE")) return "€€";
  return "€";
}

function buildMapsUrl(r: Restaurant, mode: "search" | "directions" = "search"): string {
  if (r.googleMapsUri && mode === "search") return r.googleMapsUri;
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.area}`)}`;
}

export default function RestaurantDetailModal({ restaurant, onClose }: Props) {
  const appState = useAppState();
  const insets = useSafeAreaInsets();
  if (!restaurant) return null;

  const fav = appState.favorites.some((f) => f.id === restaurant.id);
  const distance = getDistanceKm(appState.currentLocation, restaurant);
  const photoUrl = restaurant.photoName
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;
  const priceLabel = priceLevelLabel(restaurant.priceLevel);
  const typeLine = [restaurant.matchedFood?.name, restaurant.area].filter(Boolean).join(" · ");

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>

        {/* ── Hero photo ── */}
        <View style={styles.hero}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroFallback]}>
              <Text style={styles.heroEmoji}>🍽️</Text>
            </View>
          )}
          <View style={styles.heroGradient} />

          {/* Back */}
          <TouchableOpacity
            style={[styles.heroBtn, { left: 16, top: insets.top + 8 }]}
            onPress={onClose}
            hitSlop={8}
          >
            <Icon name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>

          {/* Favorite */}
          <TouchableOpacity
            style={[styles.heroBtn, { right: 16, top: insets.top + 8 }]}
            onPress={() => toggleFavorite(restaurant.id)}
            hitSlop={8}
          >
            <Icon name={fav ? "favorite" : "favorite-border"} size={21} color={fav ? theme.heart : theme.text} />
          </TouchableOpacity>
        </View>

        {/* ── Info sheet ── */}
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <Text style={styles.name}>{restaurant.name}</Text>
          {typeLine ? <Text style={styles.typeMeta}>{typeLine}</Text> : null}

          {/* Stat chips */}
          <View style={styles.chips}>
            {restaurant.rating !== undefined && (
              <View style={[styles.chip, styles.chipStar]}>
                <Icon name="star" size={14} color={theme.star} />
                <Text style={styles.chipStarText}>
                  {restaurant.rating.toFixed(1)}
                  {restaurant.userRatingCount ? `  ·  ${formatCount(restaurant.userRatingCount)}` : ""}
                </Text>
              </View>
            )}
            <View style={styles.chip}>
              <Icon name="near-me" size={13} color={theme.muted} />
              <Text style={styles.chipText}>{distance.toFixed(1)} km</Text>
            </View>
            {priceLabel ? (
              <View style={styles.chip}><Text style={styles.chipText}>{priceLabel}</Text></View>
            ) : null}
            {restaurant.openNow !== undefined && (
              <View style={[styles.chip, restaurant.openNow ? styles.chipOpen : styles.chipClosed]}>
                <Text style={[styles.chipText, restaurant.openNow ? styles.chipOpenText : styles.chipClosedText]}>
                  {restaurant.openNow ? "Abierto" : "Cerrado"}
                </Text>
              </View>
            )}
          </View>

          {/* Location card */}
          <View style={styles.locationCard}>
            <Icon name="place" size={20} color={theme.accent} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationArea}>{restaurant.area}</Text>
              {restaurant.sourceLabel ? (
                <Text style={styles.locationSource}>{restaurant.sourceLabel}</Text>
              ) : null}
            </View>
          </View>

          {/* Phone */}
          {restaurant.phoneNumber ? (
            <TouchableOpacity style={styles.linkRow} onPress={() => void Linking.openURL(`tel:${restaurant.phoneNumber}`)}>
              <Icon name="call" size={18} color={theme.accent} />
              <Text style={styles.linkText}>{restaurant.phoneNumber}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Website */}
          {restaurant.websiteUri ? (
            <TouchableOpacity style={styles.linkRow} onPress={() => void Linking.openURL(restaurant.websiteUri!)}>
              <Icon name="language" size={18} color={theme.accent} />
              <Text style={styles.linkText}>Sitio web</Text>
            </TouchableOpacity>
          ) : null}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, fav && styles.saveBtnActive]}
            onPress={() => toggleFavorite(restaurant.id)}
          >
            <Icon name={fav ? "favorite" : "favorite-border"} size={18} color={fav ? theme.accent : theme.text} />
            <Text style={[styles.saveBtnText, fav && styles.saveBtnTextActive]}>
              {fav ? "Guardado" : "Guardar"}
            </Text>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => void Linking.openURL(buildMapsUrl(restaurant, "directions"))}
          >
            <Icon name="directions" size={20} color="#FFFFFF" />
            <Text style={styles.ctaBtnText}>Cómo llegar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const HERO_H = 280;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },

  // Hero
  hero: { height: HERO_H, position: "relative" },
  heroImg: { width: "100%", height: HERO_H },
  heroFallback: { backgroundColor: theme.panel2, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 64 },
  heroGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "transparent",
  },
  heroBtn: {
    position: "absolute",
    width: 40, height: 40, borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
  },
  heroBtnText: { fontSize: 20, color: theme.text, fontWeight: "700" },
  heroBtnHeart: { color: "#FF5A3C" },

  // Sheet
  sheet: { flex: 1 },
  sheetContent: { padding: 20, gap: 14 },

  name: { fontSize: 24, fontWeight: "800", color: theme.text, letterSpacing: -0.5 },
  typeMeta: { fontSize: 14, color: theme.muted, fontWeight: "600", marginTop: -6 },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: theme.panel2, borderRadius: 999,
    borderWidth: 1, borderColor: theme.line,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.muted },
  chipStar: { backgroundColor: "rgba(242,160,7,0.10)", borderColor: "rgba(242,160,7,0.25)" },
  chipStarText: { fontSize: 13, fontWeight: "800", color: theme.star },
  chipOpen: { backgroundColor: theme.successBg, borderColor: "rgba(22,163,74,0.25)" },
  chipOpenText: { color: theme.success },
  chipClosed: { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
  chipClosedText: { color: theme.danger },

  // Location
  locationCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: theme.panel, borderRadius: 14,
    borderWidth: 1, borderColor: theme.line,
  },
  locationIcon: { fontSize: 20 },
  locationInfo: { flex: 1 },
  locationArea: { fontSize: 14, fontWeight: "700", color: theme.text },
  locationSource: { fontSize: 12.5, color: theme.muted, marginTop: 2 },

  // Links
  linkRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.line,
  },
  linkIcon: { fontSize: 18 },
  linkText: { fontSize: 15, color: theme.accent, fontWeight: "600" },

  // Save
  saveBtn: {
    height: 50, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    borderRadius: 14, borderWidth: 1.5, borderColor: theme.line,
    backgroundColor: theme.panel,
  },
  saveBtnActive: { borderColor: theme.accent },
  saveBtnText: { fontSize: 15, fontWeight: "800", color: theme.text },
  saveBtnTextActive: { color: theme.accent },

  // CTA
  ctaBtn: {
    height: 56, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    borderRadius: 16, backgroundColor: theme.accent,
    shadowColor: theme.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 4,
  },
  ctaBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
});
