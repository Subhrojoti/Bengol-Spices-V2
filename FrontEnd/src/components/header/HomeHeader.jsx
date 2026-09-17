import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { footerRoutes, HERO_OVERLAY_PATHS } from "../../config/footerRoutes";
import logoMain from "../../assets/logo/Logo_Final.png";

const HIDDEN_TABS = ["privacy", "terms", "cookies"];

const HomeHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const visibleTabs = useMemo(
    () => footerRoutes.filter((r) => !HIDDEN_TABS.includes(r.path)),
    [],
  );

  const firstTab = visibleTabs[0]?.path;

  useEffect(() => {
    if (location.pathname === "/" && firstTab) {
      navigate(`/${firstTab}`, { replace: true });
    }
  }, [location.pathname, firstTab, navigate]);

  /* Home, About, Careers and Help all open on a dark hero, so on those the
     bar starts transparent and only takes on a surface once you scroll past
     it. The legal pages have a light background from the first pixel, so
     there the bar stays solid throughout. */
  const overlaysHero = HERO_OVERLAY_PATHS.includes(location.pathname);
  const transparent = overlaysHero && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close the sheet on navigation. Adjusting state during render rather than
     in an effect avoids the extra render pass, and covers back-button
     navigation as well as taps on the menu itself. */
  const [lastPath, setLastPath] = useState(location.pathname);

  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);

    /* The layout scrolls each new page back to the top, but that lands a
       frame later. Clearing the flag here stops the bar flashing its solid
       surface over the incoming hero. */
    setScrolled(false);
  }

  /* Stop the page scrolling behind the full-screen menu. */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const go = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Two states only: clear over a hero, or dark frosted glass once you
          scroll. Because both sit on a dark surface, the type keeps one set
          of colours throughout and never shifts hue mid-scroll. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          transparent
            ? "bg-transparent"
            : "border-b border-white/10 bg-[#14100c]/70 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl backdrop-saturate-150"
        }`}>
        {/* The lit bottom edge that reads as the rim of a pane of glass */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent transition-opacity duration-300 ${
            transparent ? "opacity-0" : "opacity-100"
          }`}
        />

        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-5 md:px-10 lg:px-16">
          {/* BRAND */}
          <button
            onClick={() => go("/home")}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Bengol Spices, home">
            <img
              src={logoMain}
              alt=""
              className="h-11 w-11 rounded-xl bg-white/90 object-contain p-1"
            />
            <span className="hidden sm:block">
              <span className="block text-[16px] font-semibold leading-none text-white">
                Bengol Spices
              </span>
              <span className="mt-1 block text-[10.5px] uppercase tracking-[0.08em] text-white/50">
                Pvt. Ltd.
              </span>
            </span>
          </button>

          {/* DESKTOP NAV */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {visibleTabs.map((route) => {
              const isActive = location.pathname === `/${route.path}`;

              return (
                <button
                  key={route.path}
                  onClick={() => go(`/${route.path}`)}
                  className={`group relative rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition ${
                    isActive
                      ? "text-amber-300"
                      : "text-white/70 hover:text-white"
                  }`}>
                  {route.label}

                  <span
                    className={`absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-full bg-amber-300 transition-all duration-300 ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* MOBILE TRIGGER */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-white transition hover:bg-white/10 md:hidden">
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* MOBILE MENU — a full sheet rather than a cramped side drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#14100c] md:hidden">
          <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
            <div className="flex items-center gap-2.5">
              <img
                src={logoMain}
                alt=""
                className="h-10 w-10 rounded-xl bg-white/90 object-contain p-1"
              />
              <span className="text-[16px] font-semibold text-white">
                Bengol Spices
              </span>
            </div>

            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="grid h-10 w-10 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
            {visibleTabs.map((route, i) => {
              const isActive = location.pathname === `/${route.path}`;

              return (
                <button
                  key={route.path}
                  onClick={() => go(`/${route.path}`)}
                  className={`flex w-full items-center justify-between border-b border-white/5 py-4 text-left text-[24px] font-semibold transition ${
                    isActive ? "text-amber-300" : "text-white/85 hover:text-white"
                  }`}>
                  {route.label}
                  <span className="font-sans text-[12px] font-normal text-white/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
};

export default HomeHeader;
