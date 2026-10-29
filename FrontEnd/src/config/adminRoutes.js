import { lazy } from "react";
// import AdminSettings from "../pages/Admin/AdminSettings";
// import AdminProfile from "../pages/Admin/AdminProfile";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import Groups3Icon from "@mui/icons-material/Groups3";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ListAltIcon from "@mui/icons-material/ListAlt";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import PaymentIcon from "@mui/icons-material/Payment";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { AllInbox, LocalShipping, OutboxOutlined } from "@mui/icons-material";

const AdminDashboard = lazy(() => import("../pages/Admin/Tabs/AdminDashboard/AdminDashboard"));
const Agent = lazy(() => import("../pages/Admin/Tabs/Agent/Agent"));
const EmpCreation = lazy(() => import("../pages/Admin/Tabs/EmpCreation/EmpCreation"));
const ProductCreation = lazy(() => import("../pages/Admin/Tabs/ProductCreation/ProductCreation"));
const AllProducts = lazy(() => import("../pages/Admin/Tabs/AllProducts/AllProducts"));
const Delivery = lazy(() => import("../pages/Admin/Tabs/Delivery/Delivery"));
const OrderManagement = lazy(() => import("../pages/Admin/Tabs/Orders/AdminOrdersWorkspace"));
const ReturnManagement = lazy(() => import("../pages/Admin/Tabs/Returns/ReturnManagement"));
const PaymentInfo = lazy(() => import("../pages/Admin/Tabs/PaymentInfo/PaymentInfo"));
const Targets = lazy(() => import("../pages/Admin/Tabs/Targets/Targets"));
const ProductSales = lazy(() => import("../pages/Admin/Tabs/ProductSales/ProductSales"));
const CashVerification = lazy(() => import("../pages/Admin/Tabs/CashVerification/CashVerification"));
const CustomNotification = lazy(() => import("../pages/Admin/Tabs/CustomNotification/CustomNotification"));
const AssignLocation = lazy(() => import("../pages/Admin/Tabs/AssignLocation/AssignLocation"));

export const adminRoutes = [
  {
    label: "Dashboard",
    path: "dashboard",
    group: "Overview",
    icon: DashboardIcon,
    component: AdminDashboard,
  },
  {
    label: "Agent",
    path: "agent",
    group: "People",
    icon: Groups3Icon,
    component: Agent,
  },
  {
    label: "Employee",
    path: "employees",
    group: "People",
    icon: PeopleAltIcon,
    component: EmpCreation,
  },
  {
    label: "Delivery Partner",
    path: "delivery",
    group: "People",
    icon: LocalShipping,
    component: Delivery,
  },
  {
    label: "Orders",
    path: "order-management",
    group: "Operations",
    icon: AllInbox,
    component: OrderManagement,
  },
  {
    label: "Returns",
    path: "return-management",
    group: "Operations",
    icon: OutboxOutlined,
    component: ReturnManagement,
  },
  {
    label: "Product Creation",
    path: "products",
    group: "Catalog",
    icon: Inventory2Icon,
    component: ProductCreation,
  },

  {
    label: "All Products",
    path: "allproducts",
    group: "Catalog",
    icon: ListAltIcon,
    component: AllProducts,
  },
  {
    label: "Payment Info",
    path: "payment-summary",
    group: "Performance",
    icon: PaymentIcon,
    component: PaymentInfo,
  },
  {
    label: "Cash Verification",
    path: "cash-verification",
    group: "Performance",
    icon: FactCheckIcon,
    component: CashVerification,
  },
  {
    label: "Targets",
    path: "target-management",
    group: "Performance",
    icon: AdsClickIcon,
    component: Targets,
  },
  {
    label: "Product Sales",
    path: "product-sales",
    group: "Performance",
    icon: QueryStatsIcon,
    component: ProductSales,
  },
  {
    label: "Custom Notification",
    path: "custom-notification",
    group: "Performance",
    icon: NotificationsActive,
    component: CustomNotification,
  },
  {
    label: "Assign Location",
    path: "assign-location",
    group: "People",
    icon: AddLocationIcon,
    component: AssignLocation,
  },
];
