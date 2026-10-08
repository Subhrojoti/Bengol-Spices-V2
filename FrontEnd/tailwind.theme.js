/* =====================================================================
   LIGHT AND DARK, FROM ONE SET OF CLASS NAMES

   The panels are written with ordinary Tailwind colour classes:
   bg-white, text-slate-900, border-slate-200, bg-blue-50 and so on,
   about two thousand of them. Adding a dark: twin beside every one would
   double the markup and guarantee that some are missed.

   Instead each of those colours is compiled as a CSS variable WITH ITS
   NORMAL VALUE AS THE FALLBACK:

       .bg-slate-50 { background-color: rgb(var(--f-slate-50, 248 250 252) / 1) }

   Nothing sets the variable in light mode, so the fallback applies and
   every colour is exactly what Tailwind has always produced. Dark mode is
   one block, `html.dark { --f-slate-50: …; … }`, written by this file.

   A colour means different things depending on where it is used, so there
   are three tables rather than one:

     f  fill   backgrounds (bg-*, gradient stops)
     t  text   text and placeholder colour
     l  line   borders, rings, dividers, outlines

   For example slate-900 as TEXT becomes near-white in the dark, while
   slate-900 as a button's BACKGROUND stays a dark, raised grey so the
   white label on it stays readable. One shared table cannot do both.

   Only the colour families the panels use are included; the rest keep
   Tailwind's fixed values and cost nothing.
   ===================================================================== */

import colors from "tailwindcss/colors";

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Greys the interface is built from
export const NEUTRALS = ["slate", "gray"];

// Colours that carry meaning: status, emphasis, brand accents
export const TINTS = [
  "blue",
  "rose",
  "emerald",
  "amber",
  "violet",
  "orange",
  "red",
  "teal",
  "indigo",
  "green",
  "yellow",
  "purple",
  "fuchsia",
];

const toRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const triplet = (rgb) => rgb.join(" ");

// a → b by fraction t
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/* The two surfaces everything in the dark theme sits on. Also used by the
   MUI theme (src/theme/index.js) and the stylesheet, so keep them in step. */
export const DARK_PAGE = "#0b1220";
export const DARK_SURFACE = "#111a2b";

/* ─── What the classes compile to ──────────────────────────────────── */

const reference = (kind, family, shade) =>
  `rgb(var(--${kind}-${family}-${shade}, ${triplet(toRgb(colors[family][shade]))}) / <alpha-value>)`;

const table = (kind) =>
  Object.fromEntries(
    [...NEUTRALS, ...TINTS].map((family) => [
      family,
      Object.fromEntries(SHADES.map((shade) => [shade, reference(kind, family, shade)])),
    ]),
  );

export const themedColors = {
  fill: {
    ...table("f"),
    // bg-white is "a card": white in the light theme, the dark surface in the
    // dark one. text-white is left alone, so labels on coloured buttons stay white.
    white: "rgb(var(--f-white, 255 255 255) / <alpha-value>)",
  },
  text: table("t"),
  line: {
    ...table("l"),
    // border-white / ring-white separate an avatar from what is behind it
    white: "rgb(var(--l-white, 255 255 255) / <alpha-value>)",
  },
};

/* ─── The dark values ──────────────────────────────────────────────── */

/* Backgrounds. 50-300 are the quiet fills laid on a card (hover, table
   heads, skeletons, tracks): each a step LIGHTER than the card, as raised
   things are in a dark interface. 600-950 are solid neutral buttons,
   which carry white text, so they stay mid-dark and get lighter towards
   800 because hover states are written as 900 → 800. */
const NEUTRAL_FILL = {
  50: "#172135",
  100: "#1e293b",
  200: "#2a3649",
  300: "#3b4a61",
  400: "#5b6b84",
  500: "#64748b",
  600: "#52607a",
  700: "#475569",
  800: "#3f4d63",
  900: "#334155",
  950: "#2a3649",
};

/* Text: the scale turned over. 900 (headings) is near-white, 400 (captions)
   stays a readable mid-grey, 300 (decorative icons) recedes. */
const NEUTRAL_TEXT = {
  50: "#172135",
  100: "#1f2a3c",
  200: "#2a3649",
  300: "#46566e",
  400: "#7a889d",
  500: "#94a3b8",
  600: "#a9b6c8",
  700: "#cbd5e1",
  800: "#e2e8f0",
  900: "#f1f5f9",
  950: "#f8fafc",
};

/* Borders and dividers: 100-200 are the hairlines between things. */
const NEUTRAL_LINE = {
  50: "#172135",
  100: "#1f2a3c",
  200: "#2a3649",
  300: "#3b4a61",
  400: "#5b6b84",
  500: "#7a889d",
  600: "#94a3b8",
  700: "#cbd5e1",
  800: "#e2e8f0",
  900: "#f1f5f9",
  950: "#f8fafc",
};

const surface = toRgb(DARK_SURFACE);

/* A tint's pale shades (bg-blue-50 behind blue text) become the card
   colour with a little of the hue mixed in. Its solid shades (bg-blue-600
   under a white label) are left exactly as they are. */
const tintFill = (c) => ({
  50: mix(surface, c[500], 0.14),
  100: mix(surface, c[500], 0.22),
  200: mix(surface, c[500], 0.34),
  300: mix(surface, c[500], 0.5),
});

/* Coloured text was chosen dark enough to read on white (blue-700); on a
   dark card the same hue has to be lighter (blue-300). The pale shades are
   not touched: text-blue-100 is only ever used ON a solid blue button. */
const tintText = (c) => ({
  500: c[400],
  600: c[400],
  700: c[300],
  800: c[200],
  900: c[200],
  950: c[100],
});

/* Pale tinted borders and focus rings (border-rose-200, ring-blue-100)
   become dark tinted hairlines; strong ones lighten a step. */
const tintLine = (c) => ({
  50: mix(surface, c[500], 0.16),
  100: mix(surface, c[500], 0.26),
  200: mix(surface, c[500], 0.4),
  300: mix(surface, c[500], 0.55),
  600: c[500],
  700: c[400],
  800: c[300],
  900: c[200],
});

/** Every `--x-family-shade: R G B` the dark theme sets, for `html.dark`. */
export const darkVariables = () => {
  const vars = {
    "--page": triplet(toRgb(DARK_PAGE)),
    "--surface": triplet(surface),
    "--f-white": triplet(surface),
    "--l-white": triplet(surface),
  };

  const set = (kind, family, shades) => {
    for (const [shade, value] of Object.entries(shades)) {
      vars[`--${kind}-${family}-${shade}`] = triplet(Array.isArray(value) ? value : toRgb(value));
    }
  };

  for (const family of NEUTRALS) {
    set("f", family, NEUTRAL_FILL);
    set("t", family, NEUTRAL_TEXT);
    set("l", family, NEUTRAL_LINE);
  }

  for (const family of TINTS) {
    const c = Object.fromEntries(SHADES.map((shade) => [shade, toRgb(colors[family][shade])]));
    set("f", family, tintFill(c));
    set("t", family, tintText(c));
    set("l", family, tintLine(c));
  }

  return vars;
};
