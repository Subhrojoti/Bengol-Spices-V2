import { useState } from "react";
import { Menu, MenuItem, Tooltip } from "@mui/material";
import {
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Pin,
  PinOff,
  Search,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EntityAvatar from "../common/EntityAvatar";
import ThemeToggle from "../common/ThemeToggle";

/**
 * The panel's top bar.
 *
 * Carries where you are (brand › section), a way to get anywhere quickly,
 * anything with a popover, and the account menu. Popovers live here rather
 * than in the rail, whose `overflow: hidden` would clip them.
 */
const PanelHeader = ({
  brandTitle,
  sectionLabel,
  isDesktop,
  pinned,
  onTogglePin,
  onOpenMobileNav,
  onOpenPalette,
  bell,
  profile,
  profilePath,
  accent,
  onLogout,
  height,
}) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);

  const name = profile?.name || "Administrator";
  const subtitle = profile?.employeeId || profile?.role || "Signed in";

  const closeMenu = () => setAnchor(null);

  return (
    <header
      style={{ height }}
      className="relative z-30 flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-md lg:px-5">
      {/* LEADING CONTROL */}
      {isDesktop ? (
        <Tooltip title={pinned ? "Unpin menu" : "Keep menu open"} arrow>
          <button
            onClick={onTogglePin}
            aria-label={pinned ? "Unpin menu" : "Keep menu open"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            {pinned ? <Pin size={17} /> : <PinOff size={17} />}
          </button>
        </Tooltip>
      ) : (
        <button
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100">
          <MenuIcon size={19} />
        </button>
      )}

      {/* BREADCRUMB */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="hidden shrink-0 text-[13px] font-medium text-slate-400 sm:block">
          {brandTitle}
        </span>
        <ChevronRight
          size={14}
          className="hidden shrink-0 text-slate-300 sm:block"
        />
        <h1 className="truncate text-[15.5px] font-semibold tracking-tight text-slate-900">
          {sectionLabel}
        </h1>
      </nav>

      {/* QUICK JUMP */}
      <button
        onClick={onOpenPalette}
        title="Jump to a section"
        className="group hidden shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-2.5 pr-2 text-slate-400 transition hover:border-slate-300 hover:bg-white md:flex">
        <Search size={15} />
        <span className="text-[13px] text-slate-400 transition group-hover:text-slate-600">
          Jump to…
        </span>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
          Ctrl K
        </kbd>
      </button>

      <button
        onClick={onOpenPalette}
        aria-label="Jump to a section"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:hidden">
        <Search size={17} />
      </button>

      {/* LIGHT / DARK */}
      <ThemeToggle />

      {/* BELL */}
      {bell && <div className="shrink-0">{bell}</div>}

      {/* ACCOUNT */}
      <div className="ml-0.5 shrink-0 border-l border-slate-200 pl-2">
        <button
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100">
          <EntityAvatar
            src={profile?.profilePic?.url}
            name={name}
            bordered={false}
            className="h-8 w-8 rounded-full text-[12px]"
          />

          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-[13.5px] font-semibold leading-tight text-slate-900">
              {name}
            </span>
            <span className="block truncate text-[11.5px] leading-tight text-slate-400">
              {subtitle}
            </span>
          </span>
        </button>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={closeMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 216,
                borderRadius: 2.5,
                boxShadow:
                  "0 1px 2px rgba(15,23,42,0.04), 0 14px 34px -14px rgba(15,23,42,0.3)",
                border: "1px solid rgba(15,23,42,0.08)",
              },
            },
          }}>
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="truncate text-[13.5px] font-semibold text-slate-900">
              {name}
            </p>
            <p className="truncate text-[12px] text-slate-400">{subtitle}</p>
          </div>

          {profilePath && (
            <MenuItem
              onClick={() => {
                closeMenu();
                navigate(profilePath);
              }}
              sx={{ fontSize: 13.5, py: 1.1, gap: 1.25 }}>
              <UserRound size={15} className="text-slate-400" />
              Profile
            </MenuItem>
          )}

          {/* Logout was only ever at the bottom of the rail, which is out of
              sight while the rail is collapsed. */}
          <MenuItem
            onClick={() => {
              closeMenu();
              onLogout?.();
            }}
            sx={{ fontSize: 13.5, py: 1.1, gap: 1.25, color: "#dc2626" }}>
            <LogOut size={15} />
            Log out
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
};

export default PanelHeader;
