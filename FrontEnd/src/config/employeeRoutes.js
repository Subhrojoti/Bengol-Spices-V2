import DashboardIcon from "@mui/icons-material/Dashboard";

import Inventory2Icon from "@mui/icons-material/Inventory2";
import ListAltIcon from "@mui/icons-material/ListAlt";
import Groups3Icon from "@mui/icons-material/Groups3";
import AdminDashboard from "../pages/Admin/Tabs/AdminDashboard/AdminDashboard";
import Delivery from "../pages/Admin/Tabs/Delivery/Delivery";
import OrderManagement from "../pages/Admin/Tabs/Orders/OrderManagement";
import ReturnManagement from "../pages/Admin/Tabs/Returns/ReturnManagement";
import ProductCreation from "../pages/Admin/Tabs/ProductCreation/ProductCreation";
import AllProducts from "../pages/Admin/Tabs/AllProducts/AllProducts";
import PersonIcon from "@mui/icons-material/Person";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import PaymentIcon from "@mui/icons-material/Payment";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import EmpProfile from "../components/profile/EmpProfile";
import Agent from "../pages/Admin/Tabs/Agent/Agent";
import PaymentInfo from "../pages/Admin/Tabs/PaymentInfo/PaymentInfo";
import Targets from "../pages/Admin/Tabs/Targets/Targets";
import { AllInbox, LocalShipping, OutboxOutlined } from "@mui/icons-material";
import CustomNotification from "../pages/Admin/Tabs/CustomNotification/CustomNotification";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import AssignLocation from "../pages/Admin/Tabs/AssignLocation/AssignLocation";

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
    permission: ["canManageAgents", "canPayoutIncentives"],
    component: Agent,
  },
  {
    label: "Delivery Partner",
    path: "delivery",
    group: "People",
    icon: LocalShipping,
    permission: ["canGetAllDeliveryPartners", "canManageDeliveryPartners"],
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
    label: "Targets",
    path: "target-management",
    group: "Performance",
    permission: "canSetTargets",
    icon: AdsClickIcon,
    component: Targets,
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
