import React from "react";
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appConfig } from "../config";
import { toggleFavorite } from "../state/store";
import { useAppState } from "../hooks/useAppState";
import { theme } from "../theme";
import type { Restaurant } from "../types";
import { getDistanceKm } from "../utils/geo";
import { formatCount } from "../utils/format";

type Props = { restaurant: Restaurant | null; onClose: () => void };

function buildMapsUrl(r: Restaurant, mode: "search" | "directions" = "search"): string {
  if (r.googleMapsUri && mode === "search") return r.googleMapsUri;
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}&travelmode=walking`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.area}`)}`;
}

export default function RestaurantDetailModal({ restaurant, onClose }: Props) {
  const appState = useAppState();
  if (!restaurant) return null;

  const fav = appState.favorites.some((f) => f.id === restaurant.id);
  const distance = getDistanceKm(appState.currentLocation, restaurant);
  const photoUrl = restaurant.photoName
    ? `${appConfig.api.baseUrl}/api/places/photo?name=${encodeURIComponent(restaurant.photoName)}`
    : null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{restaurant.name}</Text>

            {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />}

            <View style={styles.badges}>
              {restaurant.rating !== undefined && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    ★ {restaurant.rating.toFixed(1)}
                    {restaurant.userRatingCount ? ` · ${formatCount(restaurant.userRatingCount)} reseñas` : ""}
                  </Text>
                </View>
              )}
              {(restaurant.priceRange || restaurant.priceLevel) && (
                <View style={styles.badge}><Text style={styles.badgeText}>{restaurant.priceRange || restaurant.priceLevel}</Text></View>
              )}
              {restaurant.openNow !== undefined && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{restaurant.openNow ? "Abierto ahora" : "Cerrado ahora"}</Text>
                </View>
              )}
            </View>

            <Text style={styles.line}>{restaurant.area}</Text>
            {restaurant.phoneNumber && (
              <TouchableOpacity onPress={() => void Linking.openURL(`tel:${restaurant.phoneNumber}`)}>
                <Text style={styles.link}>{restaurant.phoneNumber}</Text>
              </TouchableOpacity>
            )}
            {restaurant.websiteUri && (
              <TouchableOpacity onPress={() => void Linking.openURL(restaurant.websiteUri!)}>
                <Text style={styles.link}>Sitio web</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.line}>{restaurant.sourceLabel} · A {distance.toFixed(1)} km</Text>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, fav && styles.btnSaved]} onPress={() => toggleFavorite(restaurant.id)}>
                <Text style={[styles.btnText, fav && styles.btnTextSaved]}>{fav ? "Guardado" : "Guardar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={() => void Linking.openURL(buildMapsUrl(restaurant))}>
                <Text style={styles.btnAccentText}>Google Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={() => void Linking.openURL(buildMapsUrl(restaurant, "directions"))}>
                <Text style={styles.btnAccentText}>Ruta</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  badge: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: theme.muted, fontSize: 13, fontWeight: "800" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  btn: { alignItems: "center", borderColor: theme.line, borderRadius: 999, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  btnAccent: { backgroundColor: theme.accent, borderColor: theme.accent },
  btnAccentText: { color: "#111015", fontWeight: "900" },
  btnSaved: { borderColor: theme.accent },
  btnText: { color: theme.text, fontWeight: "900" },
  btnTextSaved: { color: theme.accent },
  close: { alignItems: "center", alignSelf: "flex-end", backgroundColor: theme.panel2, borderRadius: 999, height: 38, justifyContent: "center", marginBottom: 4, width: 38 },
  closeText: { color: theme.text, fontSize: 24, fontWeight: "400", lineHeight: 28 },
  dialog: { backgroundColor: theme.panel, borderColor: theme.line, borderRadius: 20, borderWidth: 1, maxHeight: "88%", padding: 20, width: "100%" },
  line: { color: theme.muted, fontSize: 15, lineHeight: 22, marginVertical: 4 },
  link: { color: theme.accent, fontSize: 15, marginVertical: 4 },
  overlay: { backgroundColor: "rgba(0,0,0,0.72)", flex: 1, justifyContent: "center", padding: 16 },
  photo: { borderColor: theme.line, borderRadius: 14, borderWidth: 1, height: 200, marginVertical: 12, width: "100%" },
  title: { color: theme.text, fontSize: 22, fontWeight: "800" },
});
