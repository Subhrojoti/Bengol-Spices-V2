import { Route, Routes } from "react-router-dom";
import { lazy } from "react";
import AdminBase from "../../pages/Admin/AdminBase";
import AdminSectionBoundary from "../../components/common/AdminSectionBoundary";
import ErrorPage from "../../components/common/ErrorPage";
import { adminRoutes } from "../../config/adminRoutes";
const ProductDetails = lazy(() => import("../../pages/Admin/Tabs/AllProducts/ProductDetails"));

/* Load the Admin shell first, then only the section being opened. */
export default function AdminArea() {
  const Default = adminRoutes[0].component;

  return (
    <Routes>
      <Route element={<AdminBase />}>
        {/* adminRoutes entries expose `component`, not `element`. A bare
            /admin visit (the logged-in redirect from /admin/login) opens
            the first tab. */}
        <Route index element={<AdminSectionBoundary><Default /></AdminSectionBoundary>} />

        {adminRoutes.map((route) => {
          const Component = route.component;
          return (
            <Route key={route.path} path={route.path} element={<AdminSectionBoundary><Component /></AdminSectionBoundary>} />
          );
        })}

        <Route path="allproducts/:productId" element={<AdminSectionBoundary><ProductDetails /></AdminSectionBoundary>} />
      </Route>

      {/* A mistyped /admin/… address */}
      <Route path="*" element={<ErrorPage notFound />} />
    </Routes>
  );
}
