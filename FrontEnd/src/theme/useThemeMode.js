import { createContext, useContext } from "react";

/* The shared pieces of light / dark mode: where the choice is stored,
   which addresses it applies to, and the hook screens read it with.
   The provider that sets it all up is ThemeMode.jsx, which also explains
   how it works. */

// Also read by the small script in index.html that runs before first paint
export const THEME_STORAGE_KEY = "bengol:theme";

const PANEL = /^\/(admin|employee|delivery|marketing)(\/|$)|^\/agent\/profile-settings(\/|$)/;
const SIGN_IN = /\/login\/?$/;

/** The signed-in panels. The public site and sign-in screens are not themed. */
export const isPanelPath = (pathname) => PANEL.test(pathname) && !SIGN_IN.test(pathname);

export const ThemeModeContext = createContext({
  choice: "light",
  dark: false,
  toggle: () => {},
  setChoice: () => {},
});

/**
 * @returns {{choice: "light"|"dark", dark: boolean, toggle: () => void, setChoice: (c: string) => void}}
 *   `choice` is what the person picked; `dark` is true only while the dark
 *   theme is actually showing (their choice is dark AND a panel is open).
 */
export const useThemeMode = () => useContext(ThemeModeContext);
