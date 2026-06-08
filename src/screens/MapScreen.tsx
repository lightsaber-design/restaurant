// Lazy import de WebView — solo existe en el dev build que lo incluye.
// Si falta el módulo nativo, la pantalla degrada a un botón hacia Google Maps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebView: any = null;
try { WebView = require("react-native-webview").WebView; } catch {}

import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "../hooks/useAppState";
import { setSelectedRestaurant } from "../state/store";
import { getFilteredResults } from "../selectors";
import { theme } from "../theme";
import type { Restaurant } from "../types";

// Genera una página HTML con Leaflet (OpenStreetMap) y marcadores.
// Renderiza siempre dentro del WebView, sin necesitar API key.
function buildLeafletHtml(center: { latitude: number; longitude: number }, places: Restaurant[], selectedId: string | null): string {
  const markers = places.map((p) => ({
    id: p.id,
    lat: p.latitude,
    lng: p.longitude,
    name: p.name.replace(/'/g, "\\'").replace(/"/g, "&quot;"),
    selected: p.id === selectedId,
  }));
  return `<!doctype html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#191a21;}
  .leaflet-popup-content{font-family:sans-serif;font-weight:700;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center=[${center.latitude},${center.longitude}];
  var map=L.map('map',{zoomControl:true}).setView(center, ${places.length ? 14 : 12});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'© OpenStreetMap'
  }).addTo(map);
  var markers=${JSON.stringify(markers)};
  var group=[];
  markers.forEach(function(m){
    var icon=L.divIcon({
      html:'<div style="background:'+(m.selected?'#a985ff':'#7f5af0')+';width:'+(m.selected?22:16)+'px;height:'+(m.selected?22:16)+'px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5);"></div>',
      className:'', iconSize:[22,22], iconAnchor:[11,11]
    });
    var mk=L.marker([m.lat,m.lng],{icon:icon}).addTo(map);
    mk.bindPopup('<b>'+m.name+'</b>');
    mk.on('click',function(){
      if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m.id);}
    });
    group.push([m.lat,m.lng]);
  });
  if(group.length>1){ map.fitBounds(group,{padding:[40,40]}); }
</script>
</body></html>`;
}

export default function MapScreen() {
  const appState = useAppState();
  const insets = useSafeAreaInsets();

  const results = getFilteredResults("");
  const selected = results.find((r) => r.id === appState.selectedRestaurantId) || results[0] || null;

  const html = useMemo(
    () => buildLeafletHtml(appState.currentLocation, results, selected?.id ?? null),
    [appState.currentLocation, results, selected?.id],
  );

  const query = selected
    ? encodeURIComponent(`${selected.name}, ${selected.area}`)
    : encodeURIComponent(`restaurantes cerca de ${appState.currentLocation.label}`);
  const externalUrl = selected?.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Vista de mapa</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mapa Leaflet (o fallback si WebView no está en este build) */}
        <View style={styles.mapFrame}>
          {WebView ? (
            <WebView
              source={{ html }}
              style={styles.webview}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              onMessage={(e: { nativeEvent: { data: string } }) => setSelectedRestaurant(e.nativeEvent.data)}
            />
          ) : (
            <TouchableOpacity style={styles.mapFallback} onPress={() => void Linking.openURL(externalUrl)} activeOpacity={0.85}>
              <Text style={styles.mapFallbackIcon}>🗺</Text>
              <Text style={styles.mapFallbackText}>Abrir mapa en Google Maps</Text>
              <Text style={styles.mapFallbackHint}>El mapa embebido se activa al reinstalar el dev build.</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resumen del seleccionado */}
        {selected ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{selected.name}</Text>
            <Text style={styles.summaryText}>
              A {(selected.distanceKm ?? 0).toFixed(1)} km. Toca un pin del mapa para seleccionarlo, o abre Google Maps
              para horarios, fotos, reseñas y ruta.
            </Text>
            <TouchableOpacity style={styles.mapsBtn} onPress={() => void Linking.openURL(externalUrl)}>
              <Text style={styles.mapsBtnText}>Abrir en Google Maps</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>No hay restaurantes cargados. Haz una búsqueda en Explorar para verlos en el mapa.</Text>
          </View>
        )}

        {/* Lista de lugares */}
        {results.length > 0 && (
          <View style={styles.placeList}>
            {results.slice(0, 8).map((r, i) => {
              const active = r.id === selected?.id;
              return (
                <TouchableOpacity key={r.id} style={[styles.placeItem, active && styles.placeItemActive]} onPress={() => setSelectedRestaurant(r.id)}>
                  <Text style={styles.placeName} numberOfLines={1}>{i + 1}. {r.name}</Text>
                  <Text style={styles.placeMeta}>A {(r.distanceKm ?? 0).toFixed(1)} km</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 16 },
  header: { backgroundColor: "rgba(8, 9, 13, 0.98)", borderBottomColor: theme.line, borderBottomWidth: 1, paddingBottom: 14, paddingHorizontal: 16 },
  mapFallback: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  mapFallbackHint: { color: theme.muted2, fontSize: 13, marginTop: 8, textAlign: "center" },
  mapFallbackIcon: { fontSize: 48, marginBottom: 12 },
  mapFallbackText: { color: theme.accent, fontSize: 16, fontWeight: "900" },
  mapFrame: { aspectRatio: 3 / 4, backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 20, borderWidth: 1, minHeight: 360, overflow: "hidden" },
  mapsBtn: { alignSelf: "flex-start", backgroundColor: theme.accent, borderRadius: 999, marginTop: 12, minHeight: 42, justifyContent: "center", paddingHorizontal: 16 },
  mapsBtnText: { color: "#111015", fontWeight: "900" },
  placeItem: { backgroundColor: theme.panel2, borderColor: theme.line, borderRadius: 16, borderWidth: 1, padding: 12 },
  placeItemActive: { borderColor: theme.accent },
  placeList: { gap: 10, marginTop: 14 },
  placeMeta: { color: theme.muted, fontSize: 13, marginTop: 4 },
  placeName: { color: theme.text, fontSize: 15, fontWeight: "700" },
  screen: { backgroundColor: theme.bg, flex: 1 },
  summary: { backgroundColor: theme.panel2, borderRadius: 16, marginTop: 14, padding: 16 },
  summaryText: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  summaryTitle: { color: theme.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  title: { color: theme.text, fontSize: 24, fontWeight: "800" },
  webview: { backgroundColor: theme.panel2, flex: 1 },
});
