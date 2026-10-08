export const colors = {
  ink: {
    DEFAULT: "#221913",
    700: "#4A3D34",
    500: "#7A6C60",
    300: "#C9BEB1",
  },
  cream: {
    DEFAULT: "#FBF7F0",
    100: "#F3ECDE",
  },
  sand: {
    DEFAULT: "#E7DAC3",
    dark: "#D4C3A3",
  },
  saffron: {
    50: "#FBF0DE",
    100: "#F3DDB3",
    400: "#E3A857",
    600: "#BE7326",
    700: "#8F551A",
  },
  maroon: {
    600: "#6B2E42",
    700: "#5A2538",
    900: "#3D1926",
  },
  cardamom: {
    100: "#E1EEE3",
    600: "#3D6B4A",
    700: "#2F5439",
  },
  chili: {
    100: "#F5DFDA",
    600: "#A23B2E",
    700: "#832F25",
  },
  gold: {
    DEFAULT: "#C79A3D",
    100: "#F6ECD3",
  },
  white: "#FFFFFF",
} as const;

export const gradients = {
  hero: [colors.maroon[900], colors.maroon[600]] as [string, string],
  saffronWash: [colors.saffron[600], colors.saffron[400]] as [string, string],
};
