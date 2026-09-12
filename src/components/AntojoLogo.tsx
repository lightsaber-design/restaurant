import React from "react";
import { View } from "react-native";

interface Props {
  size?: number;
  /** Pin body + "bite" circle color (brand green) */
  c?: string;
  /** Inner face color */
  bg?: string;
  /** Three-dots color (brand orange) */
  bite?: string;
}

// ── Logo de marca Antojo ───────────────────────────────────────────────────────
// Reproducción 1:1 del SVG de marca (viewBox 0 0 100 100), con Views puras
// (sin react-native-svg):
//   · Pin teardrop verde  (cabeza r32.5 @ 50,40 + punta a 50,92)
//   · Cara blanca         (círculo r16.5 @ 50,39)
//   · "Mordisco" verde    (círculo r9.5 @ 63,29 que come la cara arriba-dcha)
//   · Tres puntos naranja (r2.4 @ 46,36 · 54,42 · 45,45)
export function AntojoLogo({ size = 104, c = "#16A34A", bg = "#FFFFFF", bite = "#FF6B4A" }: Props) {
  const u = size / 100;
  const dot = (cx: number, cy: number, r: number, color: string) => ({
    position: "absolute" as const,
    left: (cx - r) * u,
    top: (cy - r) * u,
    width: 2 * r * u,
    height: 2 * r * u,
    borderRadius: r * u,
    backgroundColor: color,
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* Punta del pin (triángulo hacia abajo, detrás de la cabeza) */}
      <View
        style={{
          position: "absolute",
          left: (50 - 26) * u,
          top: 40 * u,
          width: 0,
          height: 0,
          borderLeftWidth: 26 * u,
          borderRightWidth: 26 * u,
          borderTopWidth: 52 * u,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: c,
        }}
      />
      {/* Cabeza */}
      <View style={dot(50, 40, 32.5, c)} />
      {/* Cara blanca */}
      <View style={dot(50, 39, 16.5, bg)} />
      {/* Mordisco verde (mismo color que el cuerpo) */}
      <View style={dot(63, 29, 9.5, c)} />
      {/* Tres puntos naranja */}
      <View style={dot(46, 36, 2.4, bite)} />
      <View style={dot(54, 42, 2.4, bite)} />
      <View style={dot(45, 45, 2.4, bite)} />
    </View>
  );
}
