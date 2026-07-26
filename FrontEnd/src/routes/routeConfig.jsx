import { MarketingHub, marketingRoutes } from "../config/marketingRoutes";
import AgentLogin from "../pages/Auth/Login/AgentLogin";
import AdminLogin from "../pages/Auth/Login/AdminLogin";
import ProtectedRoute from "../routes/ProtectedRoute";
import Onboarding from "../pages/Auth/Agent/AgentOnboarding";
import { adminRoutes } from "../config/adminRoutes";
import ProfileSettings from "../pages/marketingHub/ProfileSettings/ProfileSettings.jsx";
import SetPassword from "../pages/Auth/Agent/AgentSetPassword";
import DeliveryPartnerRegister from "../pages/Auth/DeliveryPartner/DeliveryPartnerRegister";
import AdminBase from "../pages/Admin/AdminBase";
import ProductDetails from "../pages/Admin/Tabs/AllProducts/ProductDetails";
import DeliveryLogin from "../pages/Auth/Login/DeliveryLogin";
import DeliveryHub from "../pages/Delivery/DeliveryHub";
import DeliveryPanel from "../pages/Delivery/Tabs/DeliveryPanel/DeliveryPanel";
import AllOrders from "../pages/Delivery/Tabs/AllOrders/AllOrders.jsx";
import EmployeeLogin from "../pages/Auth/Login/EmployeeLogin";
import { employeeRoutes } from "../config/employeeRoutes.js";
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
            index: true,
            element: adminRoutes[0].element,
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

          {
            path: "delivery-panel",
            element: <DeliveryPanel />,
          },
          {
            path: "all-orders",
            element: <AllOrders />,
          },

          /* Default route → Overview */
          {
            index: true,
            element: <AllOrders />,
          },
        ],
      },
    ],
  },
];
