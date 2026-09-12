import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { AntojoLogo } from "./AntojoLogo";
import { theme } from "../theme";

interface Props {
  onDone: () => void;
}

// Map grid — pure View implementation (no SVG required)
function MapGrid({ width, height }: { width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={"h" + i}
          style={{ position: "absolute", left: 0, right: 0, top: 40 + i * (height / 7), height: 1.5, backgroundColor: "rgba(0,107,45,0.08)" }}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={"v" + i}
          style={{ position: "absolute", top: 0, bottom: 0, left: 30 + i * (width / 5), width: 1.5, backgroundColor: "rgba(0,107,45,0.08)" }}
        />
      ))}
    </View>
  );
}

export function SplashScreen({ onDone }: Props) {
  const dropY = useRef(new Animated.Value(-40)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pin drops in with bounce (1.4s)
    Animated.parallel([
      Animated.timing(dropY, {
        toValue: 0,
        duration: 1400,
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: false,
      }),
      Animated.timing(dropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(shadowScale, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: false,
      }),
    ]).start();

    // Fade out after 2.6s
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
      {/* Full-screen map grid */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <MapGrid width={400} height={800} />
      </View>

      {/* Center content */}
      <View style={styles.center}>
        {/* Pin with drop animation */}
        <Animated.View
          style={[
            styles.pinWrap,
            { transform: [{ translateY: dropY }], opacity: dropOpacity },
          ]}
        >
          <AntojoLogo size={96} c={theme.accent} bg="#FFFFFF" bite={theme.secondary} />
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
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 999,
  },
  center: {
    alignItems: "center",
  },
  pinWrap: {
    shadowColor: "rgba(20,40,26,1)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 16,
  },
  castShadow: {
    width: 36,
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(20,40,26,0.13)",
    marginTop: 4,
  },
  wordmark: {
    marginTop: 26,
    fontSize: 38,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: -1.2,
  },
  tagline: {
    position: "absolute",
    bottom: 52,
    fontSize: 13.5,
    fontWeight: "700",
    color: theme.muted,
  },
});
