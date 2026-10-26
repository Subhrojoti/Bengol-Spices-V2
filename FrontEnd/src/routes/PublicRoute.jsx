import { Navigate } from "react-router-dom";
import useAdminSession from "../hooks/useAdminSession";

const getToken = (role) => {
  return localStorage.getItem(`${role}Token`);
};

export default function PublicRoute({ children, role, redirectTo }) {
  const session = useAdminSession(role === "admin");
  if (role === "admin") return session.claims ? <Navigate to={redirectTo} replace /> : children;
  const token = getToken(role);

  return token ? <Navigate to={redirectTo} replace /> : children;
}
