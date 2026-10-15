import { useCallback, useEffect, useMemo, useState } from "react";
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
  // The employee's own record could not be read (no connection, a server error)
  const [failed, setFailed] = useState(false);

  /* Fetched once here and handed to the sidebar. The sidebar used to fetch
     the same profile a second time on every page load. */
  const loadProfile = useCallback(async () => {
    try {
      const res = await getEmployeeProfile();

      const permissions = res?.employee?.permissions || {};
      localStorage.setItem("permissions", JSON.stringify(permissions));

      if (res?.employee) setProfile(res.employee);
      setFailed(false);
    } catch (error) {
      console.error("Failed to load employee profile", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  /* What this employee may open comes with their record. Without it the
     panel would open with every section refused, as if they had been given
     no access at all, when the truth is only that it could not be read. */
  if (failed && !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-[17px] font-semibold text-slate-800">
            Could not load your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Check your connection and try again.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={() => {
                setLoading(true);
                loadProfile();
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Retry
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </div>
      </div>
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
