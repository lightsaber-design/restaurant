// Sistema de diseño — Antojo Original (verde brillante de marca + acento naranja)
// Tokens del diseño: primary #1da34d, accent #FF6B35, surface #f2fcf0, on-surface #151e17…
export const theme = {
  bg: "#F2FCF0",            // background / Matcha White (surface del mockup)
  bgTop: "#ECF6EB",         // surface-container-low (cabeceras)
  panel: "#FFFFFF",         // surface-container-lowest
  panel2: "#E6F1E5",        // surface-container
  chip: "#FFFFFF",
  line: "rgba(20,40,26,0.10)",
  lineStrong: "rgba(20,40,26,0.18)",
  text: "#151E17",          // on-surface (slate-800)
  muted: "#3E4A3E",         // on-surface-variant
  muted2: "#6E7A6D",        // outline
  accent: "#1DA34D",        // primary — verde característico Antojo
  accentSoft: "rgba(29,163,77,0.12)",
  onAccent: "#FFFFFF",
  star: "#F2A007",
  success: "#1DA34D",
  successBg: "rgba(29,163,77,0.14)",
  danger: "#BA1A1A",        // error
  dangerBg: "rgba(186,26,26,0.10)",
  dangerBorder: "rgba(186,26,26,0.32)",
  accent2: "#17924A",       // primary-container (verde algo más profundo)
  accentChipBg: "rgba(29,163,77,0.12)",
  accentChipText: "#14692F", // texto verde sobre chip claro
  inputBg: "#FFFFFF",
  searchBg: "#FFFFFF",

  // ── Tokens nuevos del diseño Antojo ──
  primaryContainer: "#1DA34D",   // pill activa (TabBar), badge de precio
  onPrimaryContainer: "#FFFFFF",
  secondary: "#FF6B35",          // acento naranja de marca (TRENDING, badges)
  secondaryContainer: "#FF6B35",
  heart: "#D8362E",              // corazón "favorito" relleno (rojo)
  shadow: "rgba(29,163,77,0.18)", // sombra verde de marca
};

// Categorías principales — primera es "Todo"
export const CATEGORIES = [
  { dish: "all", emoji: "🍽️", label: "Todo" },
  { dish: "hamburguesas", emoji: "🍔", label: "Burgers" },
  { dish: "pizza", emoji: "🍕", label: "Pizza" },
  { dish: "sushi", emoji: "🍣", label: "Sushi" },
  { dish: "comida saludable", emoji: "🥗", label: "Saludable" },
  { dish: "tacos", emoji: "🌮", label: "Mexicano" },
  { dish: "café", emoji: "☕", label: "Café" },
  { dish: "postres", emoji: "🍰", label: "Postres" },
];

// Más categorías (pills en búsqueda)
export const MORE_CATEGORIES = [
  "pasta", "pollo", "carne", "desayuno", "vegano",
  "mariscos", "comida india", "comida china", "kebab", "shawarma", "tapas", "ramen",
];
