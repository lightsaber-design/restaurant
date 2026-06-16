import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { AntojoLogo } from "./AntojoLogo";

interface Props {
  onDone: () => void;
}

// Map grid lines — web only (SVG), native skips
function MapGrid() {
  if (Platform.OS !== "web") return null;
  const hLines = Array.from({ length: 7 }, (_, i) =>
    React.createElement("line", {
      key: "h" + i, x1: "0", y1: String(40 + i * 110),
      x2: "100%", y2: String(20 + i * 110),
      stroke: "#C8D8C3", strokeWidth: "1.5",
    })
  );
  const vLines = Array.from({ length: 6 }, (_, i) =>
    React.createElement("line", {
      key: "v" + i, x1: String(30 + i * 80), y1: "0",
      x2: String(50 + i * 80), y2: "100%",
      stroke: "#C8D8C3", strokeWidth: "1.5",
    })
  );
  return React.createElement(
    "svg",
    {
      style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" } as object,
      xmlns: "http://www.w3.org/2000/svg",
    },
    ...hLines,
    ...vLines
  ) as unknown as React.ReactElement;
}

export function SplashScreen({ onDone }: Props) {
  const dropY = useRef(new Animated.Value(-34)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Pin drops in with bounce (1.4s)
    Animated.parallel([
      Animated.timing(dropY, {
        toValue: 0,
        duration: 1400,
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: false,
      }),
      Animated.timing(dropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(shadowScale, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Fade screen out after 2.6s
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: false,
      }).start(() => onDone());
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <MapGrid />

      {/* Logo + shadow group */}
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              transform: [{ translateY: dropY }],
              opacity: dropOpacity,
            },
          ]}
        >
          <AntojoLogo size={96} c="#16A34A" bg="#FFFFFF" bite="#FF6B4A" />
        </Animated.View>

        {/* Cast shadow under pin */}
        <Animated.View
          style={[
            styles.castShadow,
            { transform: [{ scaleX: shadowScale }], opacity: shadowScale },
          ]}
        />

        {/* Wordmark */}
        <Text style={styles.wordmark}>Antojo</Text>
      </View>

      {/* Bottom tagline */}
      <Text style={styles.tagline}>Buscando sabores cerca de ti…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#EEF3E9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  center: {
    alignItems: "center",
  },
  logoWrap: {
    // Drop shadow via filter on web, elevation on native
    ...Platform.select({
      web: { filter: "drop-shadow(0 14px 18px rgba(20,40,26,0.22))" } as object,
      default: { elevation: 12 },
    }),
  },
  castShadow: {
    width: 36,
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(20,40,26,0.13)",
    marginTop: 3,
  },
  wordmark: {
    marginTop: 24,
    fontSize: 38,
    fontWeight: "800",
    color: "#15241B",
    letterSpacing: -1.2,
  },
  tagline: {
    position: "absolute",
    bottom: 52,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#5F6E63",
  },
});
