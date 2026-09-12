import React, { useEffect, useState } from "react";
import { Platform, StatusBar, StyleSheet, Text as RNText, UIManager, View } from "react-native";
import { useFonts } from "expo-font";
import { hankenFamily, hankenFontMap } from "./src/fonts";

// LayoutAnimation necesita habilitación explícita en Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Parche global: aplica Hanken Grotesk a todo <Text>, eligiendo la familia
// según el fontWeight del estilo. Respeta los textos que ya fijan fontFamily
// (p. ej. los iconos de @expo/vector-icons), por lo que es seguro.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Se activa solo cuando las fuentes Hanken han cargado de verdad; hasta entonces
// (o si fallan) dejamos la fuente del sistema para no romper el render.
let fontsReady = false;

const RNTextAny = RNText as any;
if (!RNTextAny.__hankenPatched && typeof RNTextAny.render === "function") {
  RNTextAny.__hankenPatched = true;
  const orig = RNTextAny.render;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RNTextAny.render = function (...args: any[]) {
    const el = orig.apply(this, args);
    const flat = StyleSheet.flatten(el.props.style) || {};
    if (!fontsReady || flat.fontFamily) return el;
    return React.cloneElement(el, { style: [{ fontFamily: hankenFamily(flat.fontWeight) }, el.props.style] });
  };
}

import { SafeAreaProvider } from "react-native-safe-area-context";
import TabBar from "./src/components/TabBar";
import ExploreScreen from "./src/screens/ExploreScreen";
import SearchScreen from "./src/screens/SearchScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { SplashScreen } from "./src/components/SplashScreen";
import { useAppState } from "./src/hooks/useAppState";
import { initStore } from "./src/state/store";
import { theme } from "./src/theme";

function RootApp() {
  const appState = useAppState();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    void initStore();
  }, []);

  const view = appState.view;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bgTop} />
      <View style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, view !== "explore" && { display: "none" }]}>
          <ExploreScreen />
        </View>
        <View style={[{ flex: 1 }, view !== "search" && { display: "none" }]}>
          <SearchScreen />
        </View>
        <View style={[{ flex: 1 }, view !== "favorites" && { display: "none" }]}>
          <FavoritesScreen />
        </View>
        <View style={[{ flex: 1 }, view !== "profile" && { display: "none" }]}>
          <ProfileScreen />
        </View>
      </View>
      <TabBar activeView={view} favCount={appState.favorites.length} />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </View>
  );
}

export default function App() {
  // No bloqueamos el render por las fuentes: la app se pinta siempre y Hanken
  // entra en cuanto carga (mientras tanto, fuente del sistema). Evita pantalla
  // en blanco si las fuentes tardan o fallan.
  const [fontsLoaded] = useFonts(hankenFontMap);
  if (fontsLoaded && !fontsReady) fontsReady = true;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <RootApp />
      </View>
    </SafeAreaProvider>
  );
}
