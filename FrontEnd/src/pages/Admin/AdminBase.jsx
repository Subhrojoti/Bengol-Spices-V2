import { useNavigate } from "react-router-dom";
import PanelLayout from "../../components/layout/PanelLayout";
import { adminRoutes } from "../../config/adminRoutes";
import useLiveOrders from "../../hooks/useLiveOrders";
import useAdminSession from "../../hooks/useAdminSession";
import { useRef } from "react";
import { toast } from "sonner";
import { logoutAdminCookieSession } from "../../api/services";
import { clearAdminSession, storedAdminCookieSession } from "../../utils/adminSession";

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
  const session = useAdminSession();
  const signingOut = useRef(false);

  // New orders arrive as a toast with a chime while the panel is open
  useLiveOrders({
    tokenKey: "adminToken",
    ordersPath: "/admin/order-management",
    sessionKey: session.claims?.id || session.token,
  });

  const handleLogout = async () => {
    if (signingOut.current) return;
    const cookie = storedAdminCookieSession();
    if (cookie) {
      signingOut.current = true;
      const notice = toast.loading("Signing out…");
      try { await logoutAdminCookieSession(cookie.id); }
      catch (error) {
        if (error.response?.status !== 401) { toast.error("Could not end your session. Check your connection and try again."); return; }
      } finally { signingOut.current = false; toast.dismiss(notice); }
      if (storedAdminCookieSession() && storedAdminCookieSession().id !== cookie.id) return;
    }
    clearAdminSession();
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
