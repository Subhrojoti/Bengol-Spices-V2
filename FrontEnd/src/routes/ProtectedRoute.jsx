import { Navigate, Outlet, useLocation } from "react-router-dom";

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
  const token = getTokenByPath(location.pathname);

  return token ? <Outlet /> : <Navigate to={redirectTo} replace />;
}
