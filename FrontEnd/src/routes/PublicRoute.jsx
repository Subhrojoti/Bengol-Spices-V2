import { Navigate } from "react-router-dom";

const getToken = (role) => {
  return localStorage.getItem(`${role}Token`);
};

export default function PublicRoute({ children, role, redirectTo }) {
  const token = getToken(role);

  return token ? <Navigate to={redirectTo} replace /> : children;
}
