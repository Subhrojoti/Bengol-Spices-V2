import { Navigate, Route, Routes } from "react-router-dom";
import DeliveryHub from "../../pages/Delivery/DeliveryHub";
import DeliveryProfile from "../../components/profile/DeliveryProfile";
import ErrorPage from "../../components/common/ErrorPage";
import { deliveryRoutes } from "../../config/deliveryRoutes";

/* Everything under /delivery, loaded as one bundle on first use. Moved out
   of routeConfig unchanged; see AdminArea for why. */
export default function DeliveryArea() {
  return (
    <Routes>
      <Route element={<DeliveryHub />}>
        <Route path="profile-settings" element={<DeliveryProfile />} />

        {deliveryRoutes.map((route) => {
          const Component = route.component;
          return (
            <Route key={route.path} path={route.path} element={<Component />} />
          );
        })}

        {/* Default route → My Deliveries. Redirected rather than rendered in
            place, so the menu and the page title know where you are. */}
        <Route
          index
          element={<Navigate to="/delivery/all-orders" replace />}
        />
      </Route>

      <Route path="*" element={<ErrorPage notFound />} />
    </Routes>
  );
}
