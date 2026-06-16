import React from "react";
import { Platform, View } from "react-native";

interface Props {
  size?: number;
  c?: string;
  bg?: string;
  bite?: string;
}

// Map-pin logo with bitten hole — pixel-perfect on web, approximated on native
export function AntojoLogo({ size = 104, c = "#FFFFFF", bg = "#15903F", bite = "#FF6B4A" }: Props) {
  if (Platform.OS === "web") {
    return React.createElement(
      "svg",
      { width: size, height: size, viewBox: "0 0 100 100", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("path", {
        d: "M50 7C31 7 17.5 21 17.5 40c0 22 24.5 41.5 30.2 47.6a3.1 3.1 0 0 0 4.6 0C58 81.5 82.5 62 82.5 40 82.5 21 69 7 50 7Z",
        fill: c,
      }),
      React.createElement("circle", { cx: "50", cy: "39", r: "16.5", fill: bg }),
      React.createElement("circle", { cx: "63", cy: "29", r: "9.5", fill: c }),
      React.createElement("circle", { cx: "46", cy: "36", r: "2.4", fill: bite }),
      React.createElement("circle", { cx: "54", cy: "42", r: "2.4", fill: bite }),
      React.createElement("circle", { cx: "45", cy: "45", r: "2.4", fill: bite })
    ) as unknown as React.ReactElement;
  }

  // Native approximation
  const s = size / 100;
  return (
    <View style={{ width: size, height: size }}>
      {/* Pin head circle */}
      <View style={{
        position: "absolute", top: s * 7, left: s * 17.5,
        width: s * 65, height: s * 65,
        borderRadius: s * 32.5,
        backgroundColor: c,
      }} />
      {/* Pin tail triangle */}
      <View style={{
        position: "absolute", bottom: s * 8, left: s * 36,
        width: 0, height: 0,
        borderLeftWidth: s * 14, borderRightWidth: s * 14, borderTopWidth: s * 26,
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderTopColor: c,
      }} />
      {/* Inner hole circle */}
      <View style={{
        position: "absolute", top: s * 22.5, left: s * 33.5,
        width: s * 33, height: s * 33,
        borderRadius: s * 16.5,
        backgroundColor: bg,
      }} />
      {/* Bite mark dots */}
      {([{ cx: 46, cy: 36 }, { cx: 54, cy: 42 }, { cx: 45, cy: 45 }] as const).map((dot, i) => (
        <View key={i} style={{
          position: "absolute",
          top: s * (dot.cy - 2.4), left: s * (dot.cx - 2.4),
          width: s * 4.8, height: s * 4.8,
          borderRadius: s * 2.4,
          backgroundColor: bite,
        }} />
      ))}
    </View>
  );
}
