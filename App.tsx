import React, { useEffect, useState } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TabBar from "./src/components/TabBar";
import ExploreScreen from "./src/screens/ExploreScreen";
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
  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
}
