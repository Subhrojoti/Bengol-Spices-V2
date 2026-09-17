import About from "../pages/common/Company/AboutUs";
import Careers from "../pages/common/Company/Careers";
import HelpSupport from "../pages/common/Contact/HelpAndSupport";
import Terms from "../pages/common/Legal/TermsAndConditions";
import Privacy from "../pages/common/Legal/PrivacyPolicy";
import Home from "../pages/common/Home/Home";

/* `label` is what the header and footer show. Without it the navigation was
   rendering the raw route path in capitals — "HELP" rather than
   "Help & Support". mapRoutes only reads path and component, so this is
   additive. */
export const footerRoutes = [
  { path: "home", label: "Home", component: Home },
  { path: "about", label: "About", component: About },
  { path: "careers", label: "Careers", component: Careers },
  { path: "help", label: "Help & Support", component: HelpSupport },
  { path: "terms", label: "Terms & Conditions", component: Terms },
  { path: "privacy", label: "Privacy Policy", component: Privacy },
];

/**
 * Routes whose first section is a full-bleed dark hero. On these the fixed
 * header sits transparently on top of the hero and only takes on a surface
 * once you scroll, so the layout must not reserve space above them. Every
 * other route starts on a light background and gets the header's height
 * reserved instead. Keep this in step with the pages' own heroes.
 */
export const HERO_OVERLAY_PATHS = ["/", "/home", "/about", "/careers", "/help"];
