import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setView } from "../state/store";
import { theme } from "../theme";
import { Icon } from "./Icon";
import type { ViewName } from "../types";

type Tab = { id: ViewName; label: string; icon: string; iconActive: string };

// Iconos Material Symbols, igual que el diseño
const TABS: Tab[] = [
  { id: "explore", label: "Explorar", icon: "explore", iconActive: "explore" },
  { id: "search", label: "Buscar", icon: "search", iconActive: "search" },
  { id: "favorites", label: "Favoritos", icon: "favorite-border", iconActive: "favorite" },
  { id: "profile", label: "Perfil", icon: "person-outline", iconActive: "person" },
];

export default function TabBar({ activeView, favCount = 0 }: { activeView: ViewName; favCount?: number }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(10, insets.bottom) }]}>
      {TABS.map((tab) => {
        const active = tab.id === activeView;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => setView(tab.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <View style={styles.iconWrap}>
                <Icon
                  name={active ? tab.iconActive : tab.icon}
                  size={24}
                  color={active ? theme.onPrimaryContainer : theme.muted}
                />
                {tab.id === "favorites" && favCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{favCount > 9 ? "9+" : favCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute", top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 99,
    backgroundColor: theme.secondaryContainer,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: theme.panel,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  container: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
    // sombra verde de marca hacia arriba
    shadowColor: theme.accent, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 14, elevation: 12,
  },
  tab: { flex: 1, alignItems: "center" },
  pill: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99,
    minHeight: 44,
  },
  pillActive: { backgroundColor: theme.primaryContainer },
  icon: { color: theme.muted, fontSize: 22, fontWeight: "900" },
  iconActive: { color: theme.onPrimaryContainer },
  iconWrap: { position: "relative", marginBottom: 1 },
  label: { color: theme.muted, fontSize: 11, fontWeight: "700" },
  labelActive: { color: theme.onPrimaryContainer, fontWeight: "800" },
});
