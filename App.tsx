import React, { useEffect } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TabBar from "./src/components/TabBar";
import ExploreScreen from "./src/screens/ExploreScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { useAppState } from "./src/hooks/useAppState";
import { initStore } from "./src/state/store";
import { theme } from "./src/theme";

function RootApp() {
  const appState = useAppState();

  useEffect(() => {
    void initStore();
  }, []);

  const view = appState.view;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={{ flex: 1 }}>
        {view === "explore" && <ExploreScreen />}
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
