import { memo, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../../components/footer/Footer";
import HomeHeader from "../../components/header/HomeHeader";
import { HERO_OVERLAY_PATHS } from "../../config/footerRoutes";

const HEADER_HEIGHT = 72;

const HomeBase = () => {
  const { pathname } = useLocation();

  /* The header is fixed so it can sit transparently over a page's dark
     hero. Pages without one start at the top of the document, so they need
     the header's height reserved or the first heading slides underneath. */
  const overlaysHero = HERO_OVERLAY_PATHS.includes(pathname);

  /* React Router keeps the scroll position across navigations, so landing
     on a new page halfway down would leave the header stuck in its scrolled
     state above an untouched hero. Every tab starts at the top. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader />

      <main
        className="flex-1"
        style={{ paddingTop: overlaysHero ? 0 : HEADER_HEIGHT }}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default memo(HomeBase);
