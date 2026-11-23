import { lazy } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";

import Inventory2Icon from "@mui/icons-material/Inventory2";
import ListAltIcon from "@mui/icons-material/ListAlt";
import Groups3Icon from "@mui/icons-material/Groups3";
import PersonIcon from "@mui/icons-material/Person";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import PaymentIcon from "@mui/icons-material/Payment";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import EmpProfile from "../components/profile/EmpProfile";
import { AllInbox, LocalShipping, OutboxOutlined } from "@mui/icons-material";
import NotificationsActive from "@mui/icons-material/NotificationsActive";

const AdminDashboard = lazy(() => import("../pages/Admin/Tabs/AdminDashboard/AdminDashboard"));
const Delivery = lazy(() => import("../pages/Admin/Tabs/Delivery/Delivery"));
const OrderManagement = lazy(() => import("../pages/Admin/Tabs/Orders/AdminOrdersWorkspace"));
const ReturnManagement = lazy(() => import("../pages/Admin/Tabs/Returns/ReturnManagement"));
const ProductCreation = lazy(() => import("../pages/Admin/Tabs/ProductCreation/ProductCreation"));
const AllProducts = lazy(() => import("../pages/Admin/Tabs/AllProducts/AllProducts"));
const Agent = lazy(() => import("../pages/Admin/Tabs/Agent/Agent"));
const PaymentInfo = lazy(() => import("../pages/Admin/Tabs/PaymentInfo/PaymentInfo"));
const Targets = lazy(() => import("../pages/Admin/Tabs/Targets/Targets"));
const ProductSales = lazy(() => import("../pages/Admin/Tabs/ProductSales/ProductSales"));
const CashVerification = lazy(() => import("../pages/Admin/Tabs/CashVerification/CashVerification"));
const CustomNotification = lazy(() => import("../pages/Admin/Tabs/CustomNotification/CustomNotification"));
const AssignLocation = lazy(() => import("../pages/Admin/Tabs/AssignLocation/AssignLocation"));
const Bills = lazy(() => import("../pages/Admin/Tabs/Bills/Bills"));

/**
 * `permission` guards the route. A string means "must hold this permission";
 * an array means "must hold at least one of these".
 *
 * Keep the profile entry first — routeConfig uses employeeRoutes[0] as the
 * default landing page for a bare /employee visit.
 */
export const employeeRoutes = [
  {
    path: "profile",
    label: "Profile",
    icon: PersonIcon,
    component: EmpProfile,
  },
  {
    label: "Dashboard",
    path: "dashboard",
    group: "Overview",
    icon: DashboardIcon,
    permission: "canViewDashboardSummary",
    component: AdminDashboard,
  },
  {
    label: "Agent",
    path: "agent",
    group: "People",
    icon: Groups3Icon,
    // was `permissions:` (plural) — the guard reads `permission`, so this tab
    // was reachable by every employee regardless of their access.
    permission: ["canManageAgents", "canPayoutIncentives", "canViewStoreReports", "canReviewStoreChanges", "canSeePaymentInfo"],
    component: Agent,
  },
  {
    label: "Delivery Partner",
    path: "delivery",
    group: "People",
    icon: LocalShipping,
    permission: ["canGetAllDeliveryPartners", "canManageDeliveryPartners", "canAssignDelivery", "canAssignReturn"],
    component: Delivery,
  },
  {
    label: "Assign Location",
    path: "assign-location",
    group: "People",
    permission: "canAssignLocations",
    icon: AddLocationIcon,
    component: AssignLocation,
  },
  {
    label: "Orders",
    path: "order-management",
    group: "Operations",
    icon: AllInbox,
    permission: "canGetAllOrders",
    component: OrderManagement,
  },
  { label: "Bills", path: "bills", group: "Operations", icon: ListAltIcon, permission: "canViewBills", component: Bills },
  {
    label: "Returns",
    path: "return-management",
    group: "Operations",
    permission: "canAssignReturn",
    icon: OutboxOutlined,
    component: ReturnManagement,
  },
  {
    label: "Product Creation",
    path: "products",
    group: "Catalog",
    icon: Inventory2Icon,
    permission: "canManageProducts",
    component: ProductCreation,
  },
  {
    label: "All Products",
    path: "allproducts",
    group: "Catalog",
    icon: ListAltIcon,
    permission: "canManageProducts",
    component: AllProducts,
  },
  {
    label: "Payment Info",
    path: "payment-summary",
    group: "Performance",
    icon: PaymentIcon,
    permission: "canSeePaymentInfo",
    component: PaymentInfo,
  },
  {
    label: "Cash Verification",
    path: "cash-verification",
    group: "Performance",
    icon: FactCheckIcon,
    permission: "canVerifyPayments",
    component: CashVerification,
  },
  {
    label: "Targets",
    path: "target-management",
    group: "Performance",
    permission: "canSetTargets",
    icon: AdsClickIcon,
    component: Targets,
  },
  {
    label: "Product Sales",
    path: "product-sales",
    group: "Performance",
    icon: QueryStatsIcon,
    permission: ["canViewDashboardSummary", "canManageAgents"],
    component: ProductSales,
  },
  {
    label: "Custom Notification",
    path: "custom-notification",
    group: "Performance",
    permission: "canManageNotifications",
    icon: NotificationsActive,
    component: CustomNotification,
  },
];
