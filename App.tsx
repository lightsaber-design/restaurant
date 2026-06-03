import React, { useEffect, useState } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TabBar from "./src/components/TabBar";
import ExploreScreen from "./src/screens/ExploreScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { useAppState } from "./src/hooks/useAppState";
import { initStore } from "./src/state/store";

function RootApp() {
  const appState = useAppState();

  useEffect(() => {
    void initStore();
  }, []);

  const view = appState.view;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <View style={{ flex: 1 }}>
        {(view === "explore" || view === "map") && <ExploreScreen />}
        {view === "favorites" && <FavoritesScreen />}
        {view === "profile" && <ProfileScreen />}
      </View>
      <TabBar activeView={view} />
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
