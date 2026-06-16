import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface Props {
  size?: number;
  /** Pin body color */
  c?: string;
  /** Inner hole / window color */
  bg?: string;
  /** Bite-mark dots color */
  bite?: string;
}

// Map-pin with bitten hole — exact MarkAntojo from design, cross-platform via react-native-svg
export function AntojoLogo({ size = 104, c = "#FFFFFF", bg = "#15903F", bite = "#FF6B4A" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Pin body */}
      <Path
        d="M50 7C31 7 17.5 21 17.5 40c0 22 24.5 41.5 30.2 47.6a3.1 3.1 0 0 0 4.6 0C58 81.5 82.5 62 82.5 40 82.5 21 69 7 50 7Z"
        fill={c}
      />
      {/* Inner window */}
      <Circle cx="50" cy="39" r="16.5" fill={bg} />
      {/* Top-right overlap circle */}
      <Circle cx="63" cy="29" r="9.5" fill={c} />
      {/* Bite-mark dots */}
      <Circle cx="46" cy="36" r="2.4" fill={bite} />
      <Circle cx="54" cy="42" r="2.4" fill={bite} />
      <Circle cx="45" cy="45" r="2.4" fill={bite} />
    </Svg>
  );
}
