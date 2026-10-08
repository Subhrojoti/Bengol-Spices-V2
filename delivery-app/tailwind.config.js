/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 🔥 Delivery app palette — deliberately different from the Agent
        // app's warm spice tones. Cool teal & navy for a logistics/
        // movement/trust feel. Same token names as the Agent app so no
        // component classNames needed to change, only these values.
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
        saffron: {
          50: "#E1F5F3",
          100: "#BEE8E3",
          400: "#3FB6AC",
          600: "#0E8F86",
          700: "#0A6E67",
        },
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
        gold: {
          DEFAULT: "#E0A339",
          100: "#FBEACB",
        },
      },
      fontFamily: {
        sans: ["Manrope_400Regular"],
        "sans-medium": ["Manrope_500Medium"],
        "sans-semibold": ["Manrope_600SemiBold"],
        "sans-bold": ["Manrope_700Bold"],
        "sans-extrabold": ["Manrope_800ExtraBold"],
        display: ["Manrope_700Bold"],
        "display-bold": ["Manrope_800ExtraBold"],
        "display-black": ["Manrope_800ExtraBold"],
      },
      borderRadius: {
        xl2: "20px",
      },
    },
  },
  plugins: [],
};
