import { lazy } from "react";
import { MarketingHub, marketingRoutes } from "../config/marketingRoutes";
import ProtectedRoute from "../routes/ProtectedRoute";
import PublicRoute from "../routes/PublicRoute";
import { footerRoutes } from "../config/footerRoutes.js";
import { mapRoutes } from "../config/mapRoutes.jsx";
import HomeBase from "../pages/common/HomeBase.jsx";
import Home from "../pages/common/Home/Home";
import ErrorPage from "../components/common/ErrorPage.jsx";

/* Only the public website is bundled with the first download. Each panel
   and each sign-in or sign-up screen is fetched when someone opens it.

   They used to be imported here directly, so a visitor who only wanted to
   read the home page downloaded the admin, employee, agent and delivery
   panels as well: about 1.5 MB of script before the page could respond. */
const AdminArea = lazy(() => import("./areas/AdminArea"));
const EmployeeArea = lazy(() => import("./areas/EmployeeArea"));
const DeliveryArea = lazy(() => import("./areas/DeliveryArea"));

const AgentLogin = lazy(() => import("../pages/Auth/Login/AgentLogin"));
const AdminLogin = lazy(() => import("../pages/Auth/Login/AdminLogin"));
const EmployeeLogin = lazy(() => import("../pages/Auth/Login/EmployeeLogin"));
const DeliveryLogin = lazy(() => import("../pages/Auth/Login/DeliveryLogin"));
const Onboarding = lazy(() => import("../pages/Auth/Agent/AgentOnboarding"));
const SetPassword = lazy(() => import("../pages/Auth/Agent/AgentSetPassword"));
const ForgotPassword = lazy(() => import("../pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/Auth/ResetPassword"));
const DeliveryPartnerRegister = lazy(
  () => import("../pages/Auth/DeliveryPartner/DeliveryPartnerRegister"),
);
const ProfileSettings = lazy(
  () => import("../pages/marketingHub/ProfileSettings/ProfileSettings.jsx"),
);

export const routes = [
  /* ===================== PUBLIC ROUTES ===================== */
  {
    path: "/",
    element: <HomeBase />,
    children: [
      /* Without an index child, "/" matched HomeBase and then had nothing
         to put in its Outlet, so the bare domain rendered a header and a
         footer with an empty page between them. Only /home worked. */
      { index: true, element: <Home /> },
      // footer routes (about, careers, etc.)
      ...mapRoutes(footerRoutes),
    ],
  },
  {
    path: "/error",
    element: <ErrorPage />,
  },
  {
    path: "/admin/login",
    element: (
      <PublicRoute role="admin" redirectTo="/admin">
        <AdminLogin />
      </PublicRoute>
    ),
  },
  {
    path: "/employee/login",
    element: (
      <PublicRoute role="employee" redirectTo="/employee">
        <EmployeeLogin />
      </PublicRoute>
    ),
  },
  {
    path: "/delivery/login",
    element: (
      <PublicRoute role="delivery" redirectTo="/delivery">
        <DeliveryLogin />
      </PublicRoute>
    ),
  },
  {
    path: "/agent/login",
    element: (
      <PublicRoute role="agent" redirectTo="/marketing">
        <AgentLogin />
      </PublicRoute>
    ),
  },
  {
    path: "/agent-onboarding",
    element: <Onboarding />,
  },
  {
    path: "/agent-set-password",
    element: <SetPassword />,
  },

  /* Forgot / reset password (public) */
  {
    path: "/agent-forgot-password",
    element: <ForgotPassword role="agent" />,
  },
  {
    path: "/agent-reset-password",
    element: <ResetPassword role="agent" />,
  },
  {
    path: "/delivery-forgot-password",
    element: <ForgotPassword role="delivery" />,
  },
  {
    path: "/delivery-reset-password",
    element: <ResetPassword role="delivery" />,
  },
  {
    path: "/delivery-partner-register",
    element: <DeliveryPartnerRegister />,
  },

  /* ===================== ADMIN PROTECTED =====================
     The sign-in check stays here, outside the lazy bundle, so someone who
     is not signed in is sent to the login page without the panel being
     downloaded at all. The panel's own routes are in areas/AdminArea. */
  {
    element: <ProtectedRoute redirectTo="/admin/login" />,
    children: [{ path: "/admin/*", element: <AdminArea /> }],
  },

  /* ===================== EMPLOYEE PROTECTED ===================== */
  {
    element: <ProtectedRoute redirectTo="/employee/login" />,
    children: [{ path: "/employee/*", element: <EmployeeArea /> }],
  },

  /* ===================== AGENT / APP PROTECTED ===================== */
  {
    element: <ProtectedRoute redirectTo="/agent/login" />,
    children: [
      // profile
      {
        path: "/agent/profile-settings",
        element: <ProfileSettings />,
      },
      {
        path: "/marketing",
        element: <MarketingHub />,
        children: [
          // marketing routes
          ...marketingRoutes.map((route) => {
            const Component = route.component;
            return {
              path: route.path,
              element: <Component />,
            };
          }),

          // default route
          {
            index: true,
            element: (() => {
              const DefaultComponent = marketingRoutes[0].component;
              return <DefaultComponent />;
            })(),
          },
        ],
      },
    ],
  },

  /* ===================== DELIVERY PROTECTED ===================== */
  {
    element: <ProtectedRoute redirectTo="/delivery/login" />,
    children: [{ path: "/delivery/*", element: <DeliveryArea /> }],
  },

  /* nginx serves index.html for any address, so a mistyped or dead link
     reached the router and matched nothing at all, leaving a blank white
     page. Anything unmatched now lands on the error page instead. */
  {
    path: "*",
    element: <ErrorPage notFound />,
  },
];
