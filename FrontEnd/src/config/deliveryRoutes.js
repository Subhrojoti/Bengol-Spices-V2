import { Dashboard, History, LocalShipping } from "@mui/icons-material";
import AllOrders from "../pages/Delivery/Tabs/AllOrders/AllOrders";
import DeliveryPanel from "../pages/Delivery/Tabs/DeliveryPanel/DeliveryPanel";
import DeliveryHistory from "../pages/Delivery/Tabs/History/DeliveryHistory";

/* Keep "My Deliveries" first: routeConfig uses deliveryRoutes[0] as the page
   a bare /delivery visit opens. */
export const deliveryRoutes = [
  {
    label: "My Deliveries",
    path: "all-orders",
    group: "Work",
    icon: LocalShipping,
    component: AllOrders,
  },
  {
    label: "Overview",
    path: "delivery-panel",
    group: "Work",
    icon: Dashboard,
    component: DeliveryPanel,
  },
  {
    label: "History",
    path: "history",
    group: "Work",
    icon: History,
    component: DeliveryHistory,
  },
];
