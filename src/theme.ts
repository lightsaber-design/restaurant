// Sistema de diseño — réplica exacta de src/styles.css (:root)
export const theme = {
  bg: "#08090d",
  panel: "#121319",
  panel2: "#191a21",
  line: "#2a2b34",
  text: "#f8f7fb",
  muted: "#aaa6b3",
  muted2: "#777480",
  accent: "#a985ff",
  accent2: "#7f5af0",
  success: "#69e6b0",
  danger: "#ffb2b2",
  dangerBg: "rgba(255, 118, 118, 0.12)",
  dangerBorder: "rgba(255, 118, 118, 0.45)",
  accentChipBg: "rgba(169, 133, 255, 0.18)",
  accentChipText: "#cdbbff",
  successBg: "rgba(105, 230, 176, 0.14)",
  inputBg: "#0f1015",
  searchBg: "#0e0f14",
};

// Categorías principales (grid 4 columnas) — igual que index.html
export const CATEGORIES = [
  { dish: "hamburguesas", emoji: "🍔", label: "Hamburguesas" },
  { dish: "sushi", emoji: "🍣", label: "Sushi" },
  { dish: "pizza", emoji: "🍕", label: "Pizza" },
  { dish: "comida saludable", emoji: "🥗", label: "Saludable" },
  { dish: "tacos", emoji: "🌮", label: "Tacos" },
  { dish: "ramen", emoji: "🍜", label: "Ramen" },
  { dish: "café", emoji: "☕", label: "Café" },
  { dish: "comida económica", emoji: "💸", label: "Económico" },
];

// Más categorías (pills)
export const MORE_CATEGORIES = [
  "pasta", "pollo", "carne", "desayuno", "postres", "vegano",
  "mariscos", "comida india", "comida china", "kebab", "shawarma", "tapas",
];
