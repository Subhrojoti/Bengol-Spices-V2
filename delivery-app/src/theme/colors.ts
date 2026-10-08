// 🔥 Delivery app palette — deliberately different from the Agent app.
// Agent app = warm spice tones (maroon/saffron) for a commerce/sales feel.
// Delivery app = cool teal & navy for a logistics/movement/trust feel.
// Same token KEY NAMES as the Agent app (so no component/screen files
// needed to change) — only the underlying hex values differ.
export const colors = {
  ink: {
    DEFAULT: "#141B24",
    700: "#3C4653",
    500: "#6B7684",
    300: "#B7C1CA",
  },
  cream: {
    DEFAULT: "#F3F6F9",
    100: "#E7EEF3",
  },
  sand: {
    DEFAULT: "#DCE4EA",
    dark: "#C5D0D8",
  },
  // Primary accent — vivid teal (was warm saffron/amber).
  saffron: {
    50: "#E1F5F3",
    100: "#BEE8E3",
    400: "#3FB6AC",
    600: "#0E8F86",
    700: "#0A6E67",
  },
  // Dark hero/header surfaces — deep navy (was deep maroon/wine).
  maroon: {
    600: "#1F3F63",
    700: "#193356",
    900: "#101F33",
  },
  cardamom: {
    100: "#DCF0E4",
    600: "#1E8A52",
    700: "#176B40",
  },
  chili: {
    100: "#FBE0DD",
    600: "#C1402E",
    700: "#9A3323",
  },
  // Warm amber accent — deliberate contrast pop against the cool teal/navy base.
  gold: {
    DEFAULT: "#E0A339",
    100: "#FBEACB",
  },
  white: "#FFFFFF",
} as const;

export const gradients = {
  hero: [colors.maroon[900], colors.maroon[600]] as [string, string],
  saffronWash: [colors.saffron[600], colors.saffron[400]] as [string, string],
};
