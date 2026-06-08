import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setView } from "../state/store";
import { theme } from "../theme";
import type { ViewName } from "../types";

type Tab = { id: ViewName; label: string; icon: string };

// Orden y símbolos igual que .bottom-nav del index.html
const TABS: Tab[] = [
  { id: "explore", label: "Inicio", icon: "⌂" },
  { id: "favorites", label: "Favoritos", icon: "♡" },
  { id: "profile", label: "Perfil", icon: "♟" },
];

export default function TabBar({ activeView }: { activeView: ViewName }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(10, insets.bottom) }]}>
      {TABS.map((tab) => {
        const active = tab.id === activeView;
        return (
          <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setView(tab.id)} activeOpacity={0.7}>
            <Text style={[styles.icon, active && styles.active]}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.active]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  active: { color: theme.accent },
  container: {
    backgroundColor: "rgba(8, 9, 13, 0.98)",
    borderTopColor: theme.line,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 10,
  },
  icon: { color: theme.muted, fontSize: 26, fontWeight: "900", marginBottom: 2 },
  label: { color: theme.muted, fontSize: 12.5, fontWeight: "700" },
  tab: { alignItems: "center", flex: 1, minHeight: 54, justifyContent: "center" },
});
