import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setView } from "../state/store";
import type { ViewName } from "../types";

type Tab = { id: ViewName; label: string; icon: string };

const TABS: Tab[] = [
  { id: "explore", label: "Explorar", icon: "🔍" },
  { id: "favorites", label: "Favoritos", icon: "❤️" },
  { id: "profile", label: "Ajustes", icon: "⚙️" },
];

export default function TabBar({ activeView }: { activeView: ViewName }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 8 }]}>
      {TABS.map((tab) => {
        const active = tab.id === activeView || (activeView === "map" && tab.id === "explore");
        return (
          <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setView(tab.id)} activeOpacity={0.7}>
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopColor: "#e0e0e0",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 8,
  },
  icon: {
    fontSize: 20,
    marginBottom: 2,
  },
  label: {
    color: "#888",
    fontSize: 11,
    fontWeight: "500",
  },
  labelActive: {
    color: "#E8750A",
  },
  tab: {
    alignItems: "center",
    flex: 1,
  },
});
