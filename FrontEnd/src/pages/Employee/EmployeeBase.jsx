import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PanelLayout from "../../components/layout/PanelLayout";
import NotificationBell from "../../components/notifications/NotificationBell";
import { employeeRoutes } from "../../config/employeeRoutes";
import { getEmployeeProfile } from "../../api/services";
import { canAccessRoute } from "../../utils/permissionUtils";
import useAccessSync from "../../hooks/useAccessSync";
import useLiveOrders from "../../hooks/useLiveOrders";

const EMPLOYEE_ACCENT = {
  main: "#7c3aed",
  soft: "rgba(124, 58, 237, 0.12)",
  surface: "linear-gradient(180deg, #faf8ff 0%, #f1ecff 100%)",
};

const EmployeeBase = () => {
  const navigate = useNavigate();

  // New orders arrive as a toast with a chime; the server only sends them
  // to employees allowed to see all orders
  useLiveOrders({
    tokenKey: "employeeToken",
    ordersPath: "/employee/order-management",
  });

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  /* Fetched once here and handed to the sidebar. The sidebar used to fetch
     the same profile a second time on every page load. */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getEmployeeProfile();

        const permissions = res?.employee?.permissions || {};
        localStorage.setItem("permissions", JSON.stringify(permissions));

        if (res?.employee) setProfile(res.employee);
      } catch (error) {
        console.error("Failed to load employee profile", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("employeeToken");
    localStorage.removeItem("permissions");
    localStorage.removeItem("role");
    navigate("/employee/login", { replace: true });
  };

  /* Sign the employee out as soon as the admin changes their access, so the
     next login reflects it. */
  useAccessSync({
    enabled: !loading && Boolean(profile),
    permissions: profile?.permissions,
    onSignOut: handleLogout,
  });

  /* Only advertise tabs this employee can actually open — the sidebar used
     to list every tab and walk them into an "Access Restricted" wall. */
  const visibleItems = useMemo(
    () =>
      employeeRoutes.filter(
        (route) => route.path !== "profile" && canAccessRoute(route),
      ),
    [loading],
  );

  if (loading) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PanelLayout
      items={visibleItems}
      basePath="/employee"
      brandTitle="Employee Panel"
      accent={EMPLOYEE_ACCENT}
      storageKey="employeePanel"
      profile={profile}
      profilePath="/employee/profile"
      onLogout={handleLogout}
      bell={<NotificationBell color="#475569" popupPosition="right" />}
    />
  );
};

export default EmployeeBase;
