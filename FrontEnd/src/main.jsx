import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "./redux/store";

/* After a deploy, a tab left open still runs the previous build. The first
   time it opens a panel it asks for that build's bundle, which is no longer
   on the server, and the screen would sit on an error. Reloading picks up
   the new build. Guarded so a file that is really missing cannot loop. */
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "bundle-reloaded-at";

  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }

  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* The MUI theme and its baseline styles are set up in App, inside the
        router: which theme applies depends on the address being shown. */}
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
