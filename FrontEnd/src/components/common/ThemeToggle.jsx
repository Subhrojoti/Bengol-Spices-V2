import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "../../theme/useThemeMode";

/**
 * The light / dark switch in each panel's top bar.
 *
 * Shows the theme you would switch TO, as these switches conventionally do:
 * a moon while the panel is light, a sun while it is dark. The choice is
 * remembered in this browser.
 */
export default function ThemeToggle({ className = "" }) {
  const { dark, toggle } = useThemeMode();
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${className}`}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
