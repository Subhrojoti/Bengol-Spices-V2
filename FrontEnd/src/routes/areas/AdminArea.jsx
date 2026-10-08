import { Route, Routes } from "react-router-dom";
import AdminBase from "../../pages/Admin/AdminBase";
import ProductDetails from "../../pages/Admin/Tabs/AllProducts/ProductDetails";
import ErrorPage from "../../components/common/ErrorPage";
import { adminRoutes } from "../../config/adminRoutes";

/* Everything under /admin, loaded as one bundle the first time an admin
   opens the panel. These routes used to sit in routeConfig, which meant a
   visitor reading the public home page downloaded the whole admin panel
   with it. The routes themselves are unchanged. */
export default function AdminArea() {
  const Default = adminRoutes[0].component;

  return (
    <Routes>
      <Route element={<AdminBase />}>
        {/* adminRoutes entries expose `component`, not `element`. A bare
            /admin visit (the logged-in redirect from /admin/login) opens
            the first tab. */}
        <Route index element={<Default />} />

        {adminRoutes.map((route) => {
          const Component = route.component;
          return (
            <Route key={route.path} path={route.path} element={<Component />} />
          );
        })}

        <Route path="allproducts/:productId" element={<ProductDetails />} />
      </Route>

      {/* A mistyped /admin/… address */}
      <Route path="*" element={<ErrorPage notFound />} />
    </Routes>
  );
}
