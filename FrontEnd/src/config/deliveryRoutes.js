import DeliveryPanel from "../pages/Delivery/Tabs/DeliveryPanel/DeliveryPanel";
import AllOrders from "../pages/Delivery/Tabs/AllOrders/AllOrders";

export const deliveryRoutes = [
  {
    label: "Delivery Panel",
    path: "delivery-panel",
    fullPath: "/delivery/delivery-panel",
    component: DeliveryPanel,
  },
  {
    label: "All Orders",
    path: "all-orders",
    fullPath: "/delivery/all-orders",
    component: AllOrders,
  },
];
