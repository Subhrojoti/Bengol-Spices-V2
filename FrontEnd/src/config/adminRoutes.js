// import AdminSettings from "../pages/Admin/AdminSettings";
// import AdminProfile from "../pages/Admin/AdminProfile";
import AdminDashboard from "../pages/Admin/Tabs/AdminDashboard/AdminDashboard";
import Agent from "../pages/Admin/Tabs/Agent/Agent";
import EmpCreation from "../pages/Admin/Tabs/EmpCreation/EmpCreation";
import ProductCreation from "../pages/Admin/Tabs/ProductCreation/ProductCreation";
import AllProducts from "../pages/Admin/Tabs/AllProducts/AllProducts";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import Groups3Icon from "@mui/icons-material/Groups3";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ListAltIcon from "@mui/icons-material/ListAlt";
import NotificationsActive from "@mui/icons-material/NotificationsActive";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import PaymentIcon from "@mui/icons-material/Payment";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import { AllInbox, LocalShipping, OutboxOutlined } from "@mui/icons-material";
import Delivery from "../pages/Admin/Tabs/Delivery/Delivery";
import OrderManagement from "../pages/Admin/Tabs/Orders/OrderManagement";
import ReturnManagement from "../pages/Admin/Tabs/Returns/ReturnManagement";
import PaymentInfo from "../pages/Admin/Tabs/PaymentInfo/PaymentInfo";
import Targets from "../pages/Admin/Tabs/Targets/Targets";
import CustomNotification from "../pages/Admin/Tabs/CustomNotification/CustomNotification";
import AssignLocation from "../pages/Admin/Tabs/AssignLocation/AssignLocation";

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
    label: "Targets",
    path: "target-management",
    group: "Performance",
    icon: AdsClickIcon,
    component: Targets,
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
