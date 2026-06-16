import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { AntojoLogo } from "./AntojoLogo";

interface Props {
  onDone: () => void;
}

// Map grid — now cross-platform via react-native-svg
function MapGrid({ width, height }: { width: number; height: number }) {
  const hLines = Array.from({ length: 8 }, (_, i) => (
    <Line
      key={"h" + i}
      x1="0" y1={40 + i * (height / 7)}
      x2={width} y2={20 + i * (height / 7)}
      stroke="#DDE6D8" strokeWidth="1.5"
    />
  ));
  const vLines = Array.from({ length: 6 }, (_, i) => (
    <Line
      key={"v" + i}
      x1={30 + i * (width / 5)} y1="0"
      x2={50 + i * (width / 5)} y2={height}
      stroke="#DDE6D8" strokeWidth="1.5"
    />
  ));
  return (
    <Svg
      width={width} height={height}
      style={StyleSheet.absoluteFill}
    >
      {hLines}
      {vLines}
    </Svg>
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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
