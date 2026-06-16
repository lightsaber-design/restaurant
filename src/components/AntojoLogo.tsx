import React from "react";
import { View } from "react-native";

interface Props {
  size?: number;
  /** Pin body color */
  c?: string;
  /** Inner hole / window color */
  bg?: string;
  /** Bite-mark dots color */
  bite?: string;
}

// Map-pin logo using Views only — no native SVG required.
// Restore SVG version after: npx expo run:android
export function AntojoLogo({ size = 104, c = "#FFFFFF", bg = "#15903F", bite = "#FF6B4A" }: Props) {
  const circleD = size * 0.78;
  const circleR = circleD / 2;
  const holeD = circleD * 0.44;
  const holeR = holeD / 2;
  const dotD = circleD * 0.13;
  const dotR = dotD / 2;
  // Triangle pointing downward
  const triBase = circleD * 0.44;
  const triH = size - circleD;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "flex-start", paddingTop: size * 0.06 }}>
      {/* Circle head */}
      <View style={{
        width: circleD, height: circleD, borderRadius: circleR,
        backgroundColor: c, alignItems: "center", justifyContent: "center",
      }}>
        {/* Inner window */}
        <View style={{ width: holeD, height: holeD, borderRadius: holeR, backgroundColor: bg }} />
        {/* Bite dot 1 */}
        <View style={{ position: "absolute", width: dotD, height: dotD, borderRadius: dotR, backgroundColor: bite, top: circleD * 0.3, left: circleD * 0.24 }} />
        {/* Bite dot 2 */}
        <View style={{ position: "absolute", width: dotD, height: dotD, borderRadius: dotR, backgroundColor: bite, top: circleD * 0.46, left: circleD * 0.52 }} />
        {/* Bite dot 3 */}
        <View style={{ position: "absolute", width: dotD, height: dotD, borderRadius: dotR, backgroundColor: bite, top: circleD * 0.54, left: circleD * 0.22 }} />
      </View>
      {/* Pin tip triangle */}
      <View style={{
        marginTop: -1,
        width: 0, height: 0,
        borderLeftWidth: triBase / 2, borderRightWidth: triBase / 2,
        borderTopWidth: Math.max(triH, 2),
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderTopColor: c,
      }} />
    </View>
  );
}
