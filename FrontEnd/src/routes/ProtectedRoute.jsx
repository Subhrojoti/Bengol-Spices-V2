import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAdminSession from "../hooks/useAdminSession";

const getTokenByPath = (pathname) => {
  if (pathname.startsWith("/admin")) {
    return localStorage.getItem("adminToken");
  }
  if (pathname.startsWith("/employee")) {
    return localStorage.getItem("employeeToken");
  }
  if (pathname.startsWith("/delivery")) {
    return localStorage.getItem("deliveryToken");
  }

  // default → agent/app
  return localStorage.getItem("agentToken");
};

export default function ProtectedRoute({ redirectTo }) {
  const location = useLocation();
  const admin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const session = useAdminSession(admin);
  if (admin) return session.claims ? <Outlet /> : <Navigate to={redirectTo} replace />;
  const token = getTokenByPath(location.pathname);

  return token ? <Outlet /> : <Navigate to={redirectTo} replace />;
}
