import plugin from "tailwindcss/plugin";
import { darkVariables, themedColors } from "./tailwind.theme.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  /* `dark:` variants apply under <html class="dark">, which the app sets
     only while a signed-in panel is open (src/theme/ThemeMode.jsx). Most of
     the dark theme needs no dark: classes at all; see tailwind.theme.js. */
  darkMode: "class",

  theme: {
    extend: {
      fontFamily: {
        /* Overrides Tailwind's default sans stack so utility classes and the
           MUI theme draw on the same typeface. */
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },

      /* The same colour names as always, compiled so the dark theme can
         swap their values. In the light theme every one of these resolves
         to Tailwind's own value. Explained in tailwind.theme.js. */
      backgroundColor: themedColors.fill,
      gradientColorStops: themedColors.fill,
      textColor: themedColors.text,
      placeholderColor: themedColors.text,
      textDecorationColor: themedColors.text,
      borderColor: themedColors.line,
      divideColor: themedColors.line,
      ringColor: themedColors.line,
      outlineColor: themedColors.line,
    },
  },

  plugins: [
    plugin(({ addBase }) => {
      addBase({ "html.dark": darkVariables() });

      /* A bare `border` class takes Tailwind's default border colour, a
         light grey set on every element by its reset. In the dark theme
         that default becomes a dark hairline. :where() keeps this rule as
         weak as the reset itself, so any border-<colour> class still wins. */
      addBase({
        ":where(html.dark) *, :where(html.dark) ::before, :where(html.dark) ::after": {
          borderColor: "rgb(var(--l-slate-200))",
        },
      });
    }),
  ],
};
