import { Route, Routes } from "react-router-dom";
import EmployeeBase from "../../pages/Employee/EmployeeBase";
import ProductDetails from "../../pages/Admin/Tabs/AllProducts/ProductDetails";
import PermissionGuard from "../../components/common/PermissionGuard";
import ErrorPage from "../../components/common/ErrorPage";
import { employeeRoutes } from "../../config/employeeRoutes";

/* Everything under /employee, loaded as one bundle on first use. Moved out
   of routeConfig unchanged; see AdminArea for why. */
export default function EmployeeArea() {
  const Default = employeeRoutes[0].component;

  return (
    <Routes>
      <Route element={<EmployeeBase />}>
        {/* Default landing page */}
        <Route index element={<Default />} />

        {employeeRoutes.map((route) => {
          const Component = route.component;

          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                route.permission ? (
                  <PermissionGuard permission={route.permission}>
                    <Component />
                  </PermissionGuard>
                ) : (
                  <Component />
                )
              }
            />
          );
        })}

        {/* The products grid links to its own panel's detail page. This
            route never existed under /employee, so an employee clicking a
            product fell through to the admin panel's copy — which reads a
            different token entirely. Guarded by the same permission as the
            All Products tab it is reached from. */}
        <Route
          path="allproducts/:productId"
          element={
            <PermissionGuard permission="canManageProducts">
              <ProductDetails />
            </PermissionGuard>
          }
        />
      </Route>

      <Route path="*" element={<ErrorPage notFound />} />
    </Routes>
  );
}
