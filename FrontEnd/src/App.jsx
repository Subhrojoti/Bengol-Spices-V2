import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import AppRouter from "./routes/AppRouter";
import ErrorBoundary from "./components/common/ErrorBoundary";
import RouteMeta from "./seo/RouteMeta";
import ThemeModeProvider from "./theme/ThemeMode";
import { useThemeMode } from "./theme/useThemeMode";

/* One toaster for every panel. Rendered outside the app tree, so the font
   is set here to match the rest of the UI. The width goes here too: the
   library writes it inline, where a stylesheet cannot reach it. It follows
   the panel's light or dark mode. */
function AppToaster() {
  const { dark } = useThemeMode();

  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      toastOptions={{ duration: 3500 }}
      style={{ fontFamily: "inherit", "--width": "380px" }}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* The MUI theme and light/dark mode. Inside the router because the
          mode depends on the address: only the panels have a dark theme. */}
      <ThemeModeProvider>
        {/* Title, description and the index/noindex instruction per route */}
        <RouteMeta />

        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>

        <AppToaster />
      </ThemeModeProvider>
    </BrowserRouter>
  );
}

export default App;
