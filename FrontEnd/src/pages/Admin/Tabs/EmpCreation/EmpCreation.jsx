import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  createEmployee,
  getAllEmployees,
  updateEmployeePermissions,
  deleteEmployee,
} from "../../../../api/services";
import { Tabs, Tab, Switch, Typography, Tooltip } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const HEADER_HEIGHT = 64;

const PERMISSIONS = [
  { key: "canManageProducts", label: "Manage Products" },
  { key: "canAssignDelivery", label: "Assign Delivery" },
  { key: "canConfirmOrders", label: "Confirm Orders" },
  { key: "canGetAllOrders", label: "View All Orders" },
  { key: "canGetAllDeliveryPartners", label: "View Delivery Partners" },
  { key: "canAssignReturn", label: "Assign Returns" },
  { key: "canViewDashboardSummary", label: "View Dashboard Summary" },
  { key: "canCancelOrders", label: "Cancel Orders" },
  { key: "canManageAgents", label: "Manage Agents" },
  { key: "canSeePaymentInfo", label: "View Payment Info" },
  { key: "canSetTargets", label: "Manage Daily Targets" },
  { key: "canManageNotifications", label: "Manage Notifications" },
  { key: "canAssignLocations", label: "Assign Locations" },
  { key: "canPayoutIncentives", label: "Manage Incentives" },
  { key: "canManageDeliveryPartners", label: "Manage Delivery Partners" },
];

const EmpCreation = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [permissionLoadingId, setPermissionLoadingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    profilePic: null,
  });

  // Fetch Employee details
  useEffect(() => {
    if (activeTab === "all") {
      fetchEmployees();
    }
  }, [activeTab]);

  const fetchEmployees = async () => {
    try {
      setEmpLoading(true);
      const response = await getAllEmployees();

      if (response.success) {
        setEmployees(response.employees || []);
      } else {
        toast.error("Failed to fetch employees");
      }
    } catch (error) {
      toast.error("Error fetching employees");
    } finally {
      setEmpLoading(false);
    }
  };

  console.log("Updating permission for:", confirmModal);

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setForm((prev) => ({
      ...prev,
      profilePic: file,
    }));
  };

  const handleConfirmPermission = async () => {
    if (!confirmModal?.employeeId) {
      toast.error("Invalid employee ID");
      return;
    }

    console.log("Updating permission for:", confirmModal.employeeId);

    try {
      setPermissionLoadingId(confirmModal.employeeId);

      const response = await updateEmployeePermissions(
        confirmModal.employeeId,
        selectedPermissions,
      );

      if (response.success) {
        toast.success("Permissions updated successfully");
        fetchEmployees();
      } else {
        toast.error("Failed to update permissions");
      }
    } catch (error) {
      toast.error("Error updating permissions");
    } finally {
      setPermissionLoadingId(null);
      setConfirmModal(null);
    }
  };

  const handlePermissionChange = (key) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast.error("All fields except profile picture are required");
      return;
    }

    try {
      setLoading(true);

      await createEmployee({
        name: form.name,
        email: form.email,
        password: form.password,
        profilePic: form.profilePic,
      });

      toast.success("Employee created successfully");

      setForm({
        name: "",
        email: "",
        password: "",
        profilePic: null,
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to create employee",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?"))
      return;

    try {
      setDeleteLoadingId(employeeId);
      const response = await deleteEmployee(employeeId);
      if (response.success) {
        toast.success("Employee deleted successfully");
        setEmployees((prev) => prev.filter((e) => e.employeeId !== employeeId));
      } else {
        toast.error("Failed to delete employee");
      }
    } catch (error) {
      toast.error(error?.message || "Error deleting employee");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <div
        className="fixed top-0 left-[3%] right-0 z-10 bg-white border-b border-slate-200 px-8 flex items-center justify-between"
        style={{ height: HEADER_HEIGHT }}>
        <h1 className="text-base font-bold tracking-tight text-lg text-slate-800">
          Employee Management
        </h1>

        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            minHeight: 48,

            "& .MuiTab-root": {
              minHeight: 48,
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#000 !important", // force black
            },

            "& .MuiTab-root.Mui-selected": {
              color: "#000 !important", // keep black when selected
              fontWeight: 600,
            },
          }}
          slotProps={{
            indicator: {
              sx: {
                height: 3,
                borderRadius: 2,
                backgroundColor: "#2563eb",
              },
            },
          }}>
          <Tab value="create" label="Employee Creation" />
          <Tab value="all" label="All Employees" />
        </Tabs>
      </div>

      <div
        className="h-full flex items-center justify-center px-6 min-h-screen overflow-y-auto"
        style={{ paddingTop: HEADER_HEIGHT }}>
        {activeTab === "create" ? (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
              <div className="px-8 py-5 bg-gradient-to-br from-blue-200 to-gray-100">
                <h2 className="text-black text-base font-semibold text-lg tracking-tight">
                  New Employee Account
                </h2>
                <p className="text-black/70 text-xs mt-2">
                  Create a new account for secure access.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
                <ModernInput
                  label="Full Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                />

                <ModernInput
                  label="Email Address"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />

                <div>
                  <ModernInput
                    label="Password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    At least 8 characters with uppercase, lowercase, number and
                    symbol.
                  </p>
                </div>

                <label className="flex items-center gap-4 p-4 rounded-lg cursor-pointer border-2 border-dashed border-slate-300 hover:border-blue-500">
                  <div className="w-20 h-20 flex items-center justify-center rounded-md bg-white border border-slate-200 overflow-hidden">
                    {form.profilePic ? (
                      <img
                        src={URL.createObjectURL(form.profilePic)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="text-slate-400" fontSize="large" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-slate-700">
                      Profile Photo (Optional)
                    </span>
                    <span className="text-xs text-slate-500">
                      Click to upload image (JPG only, max 5 MB)
                    </span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleFileChange}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium
                             hover:bg-blue-700
                             active:scale-[0.995]
                             disabled:opacity-60
                             transition-all duration-200">
                  {loading ? "Creating..." : "Create Employee"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="w-full my-10 max-w-8xl h-auto bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-base font-medium text-slate-800 tracking-tight">
                  All Employees
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {employees.length} employees found
                </p>
              </div>
            </div>

            {empLoading ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                Loading employees...
              </div>
            ) : employees.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                No employees found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full  min-w-max text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-8 py-4">Employee ID</th>
                      <th className="px-8 py-4">Name</th>
                      <th className="px-8 py-4">Email</th>
                      <th className="px-8 py-4">Role</th>
                      <th className="px-8 py-4">Permissions</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Created</th>
                      <th className="px-8 py-4">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {employees.map((emp) => (
                      <tr
                        key={emp._id}
                        className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-4 font-medium text-slate-800">
                          {emp.employeeId || "-"}
                        </td>

                        <td className="px-8 py-4 text-slate-700">{emp.name}</td>

                        <td className="px-8 py-4 text-slate-600">
                          {emp.email}
                        </td>

                        <td className="px-8 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                            {emp.role}
                          </span>
                        </td>

                        <td className="px-8 py-4">
                          {(() => {
                            const permissions = emp.permissions || {};
                            const permissionValues = Object.values(permissions);
                            const enabledCount =
                              permissionValues.filter(Boolean).length;
                            const totalPermissions = PERMISSIONS.length;

                            let accessLabel = "No Access";

                            if (enabledCount === totalPermissions) {
                              accessLabel = "Full Access";
                            } else if (enabledCount > 0) {
                              accessLabel = "Limited Access";
                            }

                            return (
                              <button
                                disabled={
                                  permissionLoadingId === emp.employeeId
                                }
                                onClick={() => {
                                  setConfirmModal(emp);

                                  const perms = emp.permissions || {};

                                  const updatedPermissions = PERMISSIONS.reduce(
                                    (acc, perm) => {
                                      acc[perm.key] = perms[perm.key] || false;
                                      return acc;
                                    },
                                    {},
                                  );

                                  setSelectedPermissions(updatedPermissions);
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition
                                  ${
                                    enabledCount === totalPermissions
                                      ? "bg-green-50 text-green-600"
                                      : enabledCount > 0
                                        ? "bg-yellow-50 text-yellow-600"
                                        : "bg-red-50 text-red-600"
                                  }`}>
                                {permissionLoadingId === emp.employeeId
                                  ? "Updating..."
                                  : accessLabel}
                              </button>
                            );
                          })()}
                        </td>

                        <td className="px-8 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                            {emp.status}
                          </span>
                        </td>

                        <td className="px-8 py-4 text-slate-500">
                          {new Date(emp.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-4">
                          <Tooltip title="Delete Employee">
                            <button
                              disabled={deleteLoadingId === emp.employeeId}
                              onClick={() =>
                                handleDeleteEmployee(emp.employeeId)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                              <DeleteOutlineIcon fontSize="small" />
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <h3 className="text-base font-medium text-slate-800">
              Manage Permissions
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {PERMISSIONS.map((perm) => (
                <div
                  key={perm.key}
                  className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg transition">
                  <span className="text-sm text-slate-700">{perm.label}</span>

                  <Switch
                    checked={selectedPermissions[perm.key] || false}
                    onChange={() => handlePermissionChange(perm.key)}
                    size="small"
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": {
                        color: "#2564ebd7", // blue thumb
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                        {
                          backgroundColor: "#2563eb", // blue track
                        },
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                Cancel
              </button>

              <button
                onClick={handleConfirmPermission}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                Update Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModernInput = ({ label, ...props }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-slate-700 tracking-tight">
      {label}
    </label>
    <input
      {...props}
      required
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm
                 focus:border-blue-600
                 focus:ring-2 focus:ring-blue-600/20
                 outline-none
                 transition-all duration-200"
    />
  </div>
);

export default EmpCreation;
