import { createTheme } from "@mui/material/styles";

/* Kept identical to the Tailwind stack so MUI components and Tailwind markup
   never render in two different typefaces on the same screen. */
export const FONT_STACK = [
  "Inter",
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
].join(", ");

export const theme = createTheme({
  palette: {
    primary: {
      main: "#C97A3A",
    },
    background: {
      default: "#f7f8fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#1f2937",
      secondary: "#6b7280",
    },
    divider: "#e5e7eb",
  },
  typography: {
    fontFamily: FONT_STACK,
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
});
