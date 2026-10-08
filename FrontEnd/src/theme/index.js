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

const typography = {
  fontFamily: FONT_STACK,
  button: {
    textTransform: "none",
    fontWeight: 500,
  },
};

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
  typography,
});

/* The dark counterpart, for the MUI pieces (dialogs, menus, drawers, text
   fields, and most of the agent's Marketing Hub).

   The page and card colours are the same two the Tailwind side uses
   (DARK_PAGE and DARK_SURFACE in tailwind.theme.js), so a MUI dialog and a
   Tailwind card sitting next to each other are the same colour. */
export const DARK_PAGE = "#0b1220";
export const DARK_SURFACE = "#111a2b";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      // The same brand copper as the light theme: white labels sit on it
      main: "#C97A3A",
    },
    background: {
      default: DARK_PAGE,
      paper: DARK_SURFACE,
    },
    text: {
      primary: "#e2e8f0",
      secondary: "#94a3b8",
    },
    divider: "#2a3649",
  },
  typography,
  components: {
    /* In dark mode MUI lays a translucent white gradient over every Paper to
       suggest elevation, which makes each dialog and menu a slightly
       different grey from the cards around it. One surface colour instead. */
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
});
