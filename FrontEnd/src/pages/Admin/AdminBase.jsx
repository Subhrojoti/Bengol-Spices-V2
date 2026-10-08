import { useNavigate } from "react-router-dom";
import PanelLayout from "../../components/layout/PanelLayout";
import { adminRoutes } from "../../config/adminRoutes";
import useLiveOrders from "../../hooks/useLiveOrders";

const ADMIN_ACCENT = {
  main: "#2563eb",
  soft: "rgba(37, 99, 235, 0.12)",
  surface: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
};

/* Admin signs in against environment credentials, so there is no profile
   record to load — just a fixed identity for the header. */
const ADMIN_IDENTITY = { name: "Administrator", role: "Full access" };

const AdminBase = () => {
  const navigate = useNavigate();

  // New orders arrive as a toast with a chime while the panel is open
  useLiveOrders({
    tokenKey: "adminToken",
    ordersPath: "/admin/order-management",
  });

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("role");
    navigate("/admin/login", { replace: true });
  };

  return (
    <PanelLayout
      items={adminRoutes}
      basePath="/admin"
      brandTitle="Admin Panel"
      accent={ADMIN_ACCENT}
      storageKey="adminPanel"
      profile={ADMIN_IDENTITY}
      onLogout={handleLogout}
    />
  );
};

export default AdminBase;
