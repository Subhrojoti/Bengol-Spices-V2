/* Build-time only. scripts/prerender.mjs compiles this file and calls
   render() once per public page to get that page's HTML.

   It mounts the public website alone: the same layout, header, footer and
   pages the browser shows, but none of the panels, and without the browser
   router. Nothing here ships to visitors. */
import { renderToString } from "react-dom/server";
import { Route, Routes, StaticRouter } from "react-router-dom";
import HomeBase from "./pages/common/HomeBase.jsx";
import Home from "./pages/common/Home/Home";
import ErrorPage from "./components/common/ErrorPage.jsx";
import { footerRoutes } from "./config/footerRoutes.js";
import heroLarge from "./assets/logo/BS_Home.webp";
import heroSmall from "./assets/logo/BS_Home-960.webp";

/* The home page's main image, so the build can tell the browser to start
   fetching it before it has parsed anything else. */
export const heroImage = { large: heroLarge, small: heroSmall };

/**
 * @param {string} url   path to render, e.g. "/about"
 * @param {object} data  build-time data a page can start from (the help
 *                       page's questions); also written into the page so
 *                       the browser starts from the same thing
 * @returns {string} HTML for the inside of <div id="root">
 */
export function render(url, data = {}) {
  globalThis.__PRERENDER__ = data;

  try {
    return renderToString(
      <StaticRouter location={url}>
        <Routes>
          <Route path="/" element={<HomeBase />}>
            <Route index element={<Home />} />
            {footerRoutes.map((route) => {
              const Page = route.component;
              return <Route key={route.path} path={route.path} element={<Page />} />;
            })}
          </Route>
          <Route path="*" element={<ErrorPage notFound />} />
        </Routes>
      </StaticRouter>,
    );
  } finally {
    delete globalThis.__PRERENDER__;
  }
}
