import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { darkTheme, theme as lightTheme } from "./index";
import { THEME_STORAGE_KEY, ThemeModeContext, isPanelPath } from "./useThemeMode";

/* =====================================================================
   LIGHT / DARK MODE FOR THE SIGNED-IN PANELS

   The person's choice is remembered in this browser and applies to the
   four panels: admin, employee, delivery and the agent's Marketing Hub.

   The public website and the sign-in screens are not affected. They have
   their own designed look (the dark hero, the cream sections) and no
   second colour scheme; switching the panel to dark must not repaint
   them. So "dark" is only ever in force while a panel address is open.

   Being in force means three things, all set here:
     - <html class="dark">       the Tailwind side (tailwind.theme.js)
     - the dark MUI theme        dialogs, menus, drawers, MUI screens
     - useThemeMode().dark       for the few colours set in code (charts)
   ===================================================================== */

const readChoice = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light"; // storage blocked: the panel simply stays light
  }
};

export default function ThemeModeProvider({ children }) {
  const { pathname } = useLocation();
  const [choice, setChoiceState] = useState(readChoice);

  const dark = choice === "dark" && isPanelPath(pathname);

  const setChoice = useCallback((next) => {
    const value = next === "dark" ? "dark" : "light";
    setChoiceState(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* not remembered, but it still applies for this visit */
    }
  }, []);

  const toggle = useCallback(
    () => setChoice(choice === "dark" ? "light" : "dark"),
    [choice, setChoice],
  );

  /* Before the browser paints, so a panel never shows a frame in the wrong
     theme. Removed again on the way out to a public page. */
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "";

    return () => {
      root.classList.remove("dark");
      root.style.colorScheme = "";
    };
  }, [dark]);

  // Changed in another tab of the same browser: follow it
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) setChoiceState(readChoice());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ choice, dark, toggle, setChoice }),
    [choice, dark, toggle, setChoice],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={dark ? darkTheme : lightTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
