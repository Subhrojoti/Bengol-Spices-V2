import { Navigate } from "react-router-dom";
import { MarketingHub, marketingRoutes } from "../config/marketingRoutes";
import AgentLogin from "../pages/Auth/Login/AgentLogin";
import AdminLogin from "../pages/Auth/Login/AdminLogin";
import ProtectedRoute from "../routes/ProtectedRoute";
import Onboarding from "../pages/Auth/Agent/AgentOnboarding";
import { adminRoutes } from "../config/adminRoutes";
import ProfileSettings from "../pages/marketingHub/ProfileSettings/ProfileSettings.jsx";
import SetPassword from "../pages/Auth/Agent/AgentSetPassword";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import ResetPassword from "../pages/Auth/ResetPassword";
import DeliveryPartnerRegister from "../pages/Auth/DeliveryPartner/DeliveryPartnerRegister";
import AdminBase from "../pages/Admin/AdminBase";
import ProductDetails from "../pages/Admin/Tabs/AllProducts/ProductDetails";
import DeliveryLogin from "../pages/Auth/Login/DeliveryLogin";
import DeliveryHub from "../pages/Delivery/DeliveryHub";
import AllOrders from "../pages/Delivery/Tabs/AllOrders/AllOrders.jsx";
import EmployeeLogin from "../pages/Auth/Login/EmployeeLogin";
import { employeeRoutes } from "../config/employeeRoutes.js";
import { deliveryRoutes } from "../config/deliveryRoutes.js";
import EmployeeBase from "../pages/Employee/EmployeeBase";
import PermissionGuard from "../components/common/PermissionGuard.jsx";
import PublicRoute from "../routes/PublicRoute";
import { footerRoutes } from "../config/footerRoutes.js";
import { mapRoutes } from "../config/mapRoutes.jsx";
import HomeBase from "../pages/common/HomeBase.jsx";

import DeliveryProfile from "../components/profile/DeliveryProfile.jsx";
import ErrorPage from "../components/common/ErrorPage.jsx";
export const routes = [
  /* ===================== PUBLIC ROUTES ===================== */
  {
    path: "/",
    element: <HomeBase />,
    children: [
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

  /* ===================== ADMIN PROTECTED ===================== */
  {
    element: <ProtectedRoute redirectTo="/admin/login" />,
    children: [
      {
        path: "/admin",
        element: <AdminBase />,
        children: [
          ...adminRoutes.map((route) => {
            const Component = route.component;
            return {
              path: route.path,
              element: <Component />,
            };
          }),
          {
            path: "allproducts/:productId",
            element: <ProductDetails />,
          },
          {
            /* adminRoutes entries expose `component`, not `element`.
               Reading `.element` here rendered undefined, so a bare
               /admin visit (e.g. the logged-in redirect from
               /admin/login) showed an empty page. */
            index: true,
            element: (() => {
              const DefaultComponent = adminRoutes[0].component;
              return <DefaultComponent />;
            })(),
          },
        ],
      },
    ],
  },
  /* ===================== EMPLOYEE PROTECTED ===================== */
  {
    element: <ProtectedRoute redirectTo="/employee/login" />,
    children: [
      {
        path: "/employee",
        element: <EmployeeBase />,
        children: [
          ...employeeRoutes.map((route) => {
            const Component = route.component;

            return {
              path: route.path,
              element: route.permission ? (
                <PermissionGuard permission={route.permission}>
                  <Component />
                </PermissionGuard>
              ) : (
                <Component />
              ),
            };
          }),

          {
            /* The products grid links to its own panel's detail page. This
               route never existed under /employee, so an employee clicking a
               product fell through to the admin panel's copy — which reads a
               different token entirely. Guarded by the same permission as
               the All Products tab it is reached from. */
            path: "allproducts/:productId",
            element: (
              <PermissionGuard permission="canManageProducts">
                <ProductDetails />
              </PermissionGuard>
            ),
          },

          /* Default */
          {
            index: true,
            element: (() => {
              const DefaultComponent = employeeRoutes[0].component;
              return <DefaultComponent />;
            })(),
          },
        ],
      },
    ],
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
    children: [
      {
        path: "/delivery",
        element: <DeliveryHub />,
        children: [
          {
            path: "/delivery/profile-settings",
            element: <DeliveryProfile />,
          },

          ...deliveryRoutes.map((route) => {
            const Component = route.component;
            return {
              path: route.path,
              element: <Component />,
            };
          }),

          /* Default route → My Deliveries. Redirected rather than rendered
             in place, so the menu and the page title know where you are. */
          {
            index: true,
            element: <Navigate to="/delivery/all-orders" replace />,
          },
        ],
      },
    ],
  },
];
