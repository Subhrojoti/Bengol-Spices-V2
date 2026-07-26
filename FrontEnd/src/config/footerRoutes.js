import About from "../pages/common/Company/AboutUs";
import Careers from "../pages/common/Company/Careers";
import HelpSupport from "../pages/common/Contact/HelpAndSupport";
import Terms from "../pages/common/Legal/TermsAndConditions";
import Privacy from "../pages/common/Legal/PrivacyPolicy";
import Home from "../pages/common/Home/Home";

export const footerRoutes = [
  { path: "home", component: Home },
  { path: "about", component: About },
  { path: "careers", component: Careers },
  { path: "help", component: HelpSupport },
  { path: "terms", component: Terms },
  { path: "privacy", component: Privacy },
];
