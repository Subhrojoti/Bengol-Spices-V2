import axios from "axios";
import axiosInstance from "./axiosInstance";
import { reuseAdminRead } from "../utils/adminReads";
import { adminRequestSession } from "../utils/adminSession";
import reportAdminError from "../utils/reportAdminError";

const get = (url, config = {}) => {
  if (typeof window === "undefined" || !/^\/admin(?:\/|$)/.test(window.location.pathname)) return axiosInstance.get(url, config);
  const session = adminRequestSession();
  const requestConfig = { ...config, ...session };
  // Independently cancellable requests must not share another caller's signal.
  if (config.signal) return axiosInstance.get(url, requestConfig);
  const key = `${session._adminCookieId || session._adminSessionToken}|${config.responseType || "json"}|${axiosInstance.getUri({ url, params: config.params })}`;
  return reuseAdminRead(key, () => axiosInstance.get(url, requestConfig));
};

const API_BASE_URL = "http://localhost:8000";

export const agentRegistration = async (formData) => {
  const response = await axiosInstance.post("/agent/apply", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const adminLogin = async (email, password) => {
  const response = await axiosInstance.post("/auth/admin/login", {
    email,
    password,
  }, { headers: { "X-Admin-Auth": "cookie" }, withCredentials: true });

  return response.data;
};

export const verifyAdminCookieSession = async (id) => (await axiosInstance.get("/auth/admin/session", { _adminSessionToken: "", _adminCookieId: id })).data;
export const logoutAdminCookieSession = async (id) => (await axiosInstance.post("/auth/admin/logout", {}, { _adminSessionToken: "", _adminCookieId: id, timeout: 10000 })).data;

export const agentLogin = async (agentId, password) => {
  const response = await axiosInstance.post("/auth/agent/login", {
    agentId,
    password,
  });

  return response.data;
};

export const employeeLogin = async (employeeId, password) => {
  const response = await axiosInstance.post("/auth/employee/login", {
    employeeId,
    password,
  });

  return response.data;
};

export const agentList = async (options) => {
  const response = await get("/admin/agents", options);
  return response.data;
};

export const approveAgent = (agentId) => {
  return axiosInstance.post(`/admin/agents/${agentId}/approve`);
};

export const rejectAgent = (agentId, reason) => {
  return axiosInstance.post(`/admin/agents/${agentId}/reject`, { reason });
};

// Admin-only lifecycle/assignment operations. Mutations require an explicit UI confirmation.
export const getManagedStores = async (params, options) => (await get("/admin/store-management", { ...options, params })).data;
export const previewStoreTransfer = async (body) => (await axiosInstance.post("/admin/store-transfers/preview", body)).data;
export const transferStores = async (body) => (await axiosInstance.post("/admin/store-transfers", body)).data;
export const previewStoreRemoval = async (consumerId) => (await get(`/admin/store-management/${encodeURIComponent(consumerId)}/removal-preview`)).data;
export const removeManagedStore = async (consumerId, body) => (await axiosInstance.post(`/admin/store-management/${encodeURIComponent(consumerId)}/remove`, body)).data;
export const changeAgentAccess = async (agentId, body) => (await axiosInstance.post(`/admin/agents/${encodeURIComponent(agentId)}/access`, body)).data;
export const previewAgentDeletion = async (agentId) => (await get(`/admin/agents/${encodeURIComponent(agentId)}/purge-preview`)).data;
export const permanentlyDeleteAgent = async (agentId, body) => (await axiosInstance.post(`/admin/agents/${encodeURIComponent(agentId)}/purge`, body)).data;
export const retryAgentFileCleanup = async (requestId) => (await axiosInstance.post(`/admin/data-cleanups/${encodeURIComponent(requestId)}/retry-media`)).data;
export const getManagementAudit = async (agentId, options) => (await get("/admin/management-audit", { ...options, params: agentId ? { agentId } : undefined })).data;

export const getAgentProfile = async () => {
  const response = await get("/agent/profile");
  return response.data;
};

export const changePassword = async ({
  oldPassword,
  newPassword,
  confirmPassword,
}) => {
  const response = await axiosInstance.post("/auth/change-password", {
    oldPassword,
    newPassword,
    confirmPassword,
  });

  /* Changing the password signs out every session issued before it, and
     this one is handed a fresh token to carry on with. Without keeping it,
     the very next request would be refused as "password was changed". */
  if (response.data?.token) {
    localStorage.setItem("agentToken", response.data.token);
  }

  return response.data;
};

export const setPassword = async ({ token, password }) => {
  const response = await axiosInstance.post("/agent/auth/set-password", {
    token,
    password,
  });

  return response.data;
};

export const createStore = async ({
  storeName,
  ownerName,
  phone,
  state,
  city,
  street,
  pincode,
  latitude,
  longitude,
  storeType,
  image,
}) => {
  const formData = new FormData();

  formData.append("storeName", storeName);
  formData.append("ownerName", ownerName);
  formData.append("phone", phone);
  formData.append("state", state);
  formData.append("city", city);
  formData.append("street", street);
  formData.append("pincode", pincode);
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  formData.append("storeType", storeType);

  if (image) {
    formData.append("image", image);
  }

  const response = await axiosInstance.post("/agent/store/register", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const myStores = async () => {
  const response = await get("/agent/store/my-stores");
  return response.data;
};

export const fetchProducts = async (options) => {
  const response = await get("/products/public/allProduct", options);
  return response.data;
};

/* The catalogue priced for one of the agent's stores: location prices the
   admin set for that territory, defaults everywhere else. This is what the
   server charges, so the cart and the order always agree. */
export const fetchStoreProducts = async (consumerId) => {
  const response = await get(
    `/agent/store/${consumerId}/products`,
  );
  return response.data;
};

export const createOrder = async (payload) => {
  const response = await axiosInstance.post("/agent/orders", payload);
  return response.data;
};

export const getStoreOrders = async (consumerId) => {
  if (!consumerId) {
    throw new Error("consumerId is required to fetch store orders");
  }

  const response = await get(`/agent/orders/store/${consumerId}`);

  return response.data;
};

export const createProduct = async (formData) => {
  const response = await axiosInstance.post("/products/create", formData);
  return response.data;
};

export const getAllProducts = async (options) => {
  const response = await get("/products/all", options);
  return response.data;
};

// UPDATE PRODUCT (multipart)
export const updateProduct = async (productId, formData) => {
  const response = await axiosInstance.put(
    `/products/update/${productId}`,
    formData,
  );
  return response.data;
};

// DELETE PRODUCT
export const deleteProduct = async (productId) => {
  const response = await axiosInstance.delete(`/products/delete/${productId}`);
  return response.data;
};

// Verify OTP
export const verifyStoreOtp = async ({ storeId, otp }) => {
  const response = await axiosInstance.post(
    "/agent/store/register/verify-otp",
    {
      storeId,
      otp,
    },
  );

  return response.data;
};

// Employee Creation

export const createEmployee = async ({ name, email, password, profilePic }) => {
  /* Must be multipart: the route runs multer (`upload.single("profilePic")`).
     This used to post a plain object, so the File serialised to `{}` in JSON
     and every profile photo was silently dropped on the way to the server. */
  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("password", password);

  if (profilePic) formData.append("profilePic", profilePic);

  const response = await axiosInstance.post("/employee/create", formData);

  return response.data;
};

// Get all Employees

export const getAllEmployees = async (options) => {
  const response = await get("/employee/all", options);
  return response.data;
};

// Permission for Emp

export const updateProductPermission = async (employeeId, payload) => {
  const response = await axiosInstance.patch(
    `/admin/employees/${employeeId}/product-permission`,
    payload,
  );

  return response.data;
};

// Product details

export const getSingleProduct = async (productId, options) => {
  const response = await get(`/products/single/${productId}`, options);
  return response.data;
};

// Dashboard summary

export const getDashboardSummary = async (options) => {
  const response = await get("/admin/dashboard-summary/", options);
  return response.data;
};

/** What is waiting on the office: orders to confirm, overdue dues,
 *  applications to review. Only the parts the caller may act on. */
export const getAttention = async () => {
  const response = await get("/admin/attention");
  return response.data;
};

// DELIVERY LOGIN
export const deliveryLogin = async (phone, password) => {
  const response = await axiosInstance.post("/delivery-partner/login", {
    phone,
    password,
  });

  return response.data;
};

// Delivery Partner Register

export const deliveryPartnerRegister = async (formData) => {
  const response = await axiosInstance.post(
    "/delivery-partner/register",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

// Delivery Logout

export const deliveryLogout = async () => {
  const response = await axiosInstance.post("/delivery-partner/logout");
  return response.data;
};

// All Orders

export const getAllAgentOrders = async (options) => {
  const response = await get("/agent/orders/all", options);
  return response.data;
};

// CONFIRM ORDER
export const confirmOrder = async (orderId) => {
  const response = await axiosInstance.put(`/agent/orders/${orderId}/confirm`);
  return response.data;
};

// CANCEL ORDER
export const cancelOrder = async (orderId, reason) => {
  const response = await axiosInstance.put(`/agent/orders/${orderId}/cancel`, {
    reason,
  });
  return response.data;
};

// All Delivery Partners

export const getAllDeliveryPartners = async (options) => {
  const response = await get("/delivery-partner/all", options);
  return response.data;
};

// Assign order to delivery partner

export const assignOrderToPartner = async (orderId, partnerId) => {
  const response = await axiosInstance.put(`/agent/orders/${orderId}/assign`, {
    partnerId,
  });
  return response.data;
};

// Assign return to delivery partner

export const assignReturnToPartner = async (returnId, partnerId) => {
  const response = await axiosInstance.put(
    `/returns/${returnId}/assign-pickup`,
    { partnerId },
  );
  return response.data;
};

// Get assigned Delivery Orders

export const getDeliveryPartnerOrders = async () => {
  const response = await get("/delivery-partner/orders");
  return response.data;
};

// Get assigned Delivery Returns

export const getDeliveryPartnerReturns = async () => {
  const response = await get("/returns/delivery/assigned");
  return response.data;
};

// Update Delivery order status

// Marking an order DELIVERED needs the store owner's 6-digit delivery code
export const updateDeliveryStatus = async (orderId, status, deliveryCode) => {
  const response = await axiosInstance.put(
    `/agent/orders/${orderId}/delivery-status`,
    deliveryCode ? { status, deliveryCode } : { status },
  );
  return response.data;
};

// Update Return order status

export const updateReturnStatus = async (returnId, status) => {
  const response = await axiosInstance.put(
    `/returns/delivery/${returnId}/status`,
    { status },
  );
  return response.data;
};

// Delivered orders and completed returns of the signed-in delivery partner
export const getMyDeliveryHistory = async () => {
  const response = await get("/delivery-partner/history");
  return response.data;
};

// Delivery partner changes their own password; answers with a fresh token
export const changeDeliveryPassword = async (payload) => {
  const response = await axiosInstance.post(
    "/delivery-partner/change-password",
    payload,
  );
  return response.data;
};

// Initiate return in Agent screen
export const initiateReturn = async (orderId, reason) => {
  const response = await axiosInstance.post(`/returns/${orderId}/initiate`, {
    reason,
  });

  return response.data;
};

// Get My Returns

export const getMyReturns = async () => {
  const response = await get("/returns/my-returns");
  return response.data;
};

export const getAllReturns = async (options) => {
  const response = await get("/returns/all", options);
  return response.data;
};

// Cancel Return

export const cancelReturn = async (returnId, reason) => {
  const response = await axiosInstance.put(`/returns/${returnId}/cancel`, {
    reason,
  });
  return response.data;
};

// Employee permissions

export const updateEmployeePermissions = async (employeeId, permissions) => {
  const response = await axiosInstance.put(`/admin/${employeeId}/permissions`, {
    permissions,
  });
  return response.data;
};

// Delivery Dashboard

export const getDeliveryPartnerDashboard = async () => {
  const response = await get("/delivery-partner/dashboard");
  return response.data;
};

// Employee Profile

export const getEmployeeProfile = async () => {
  const response = await get("/employee/profile");
  return response.data;
};

// Get active orders

export const getActiveOrders = async (options) => {
  const response = await get("/agent/orders/active", options);
  return response.data;
};

// Get active returns

export const getActiveReturns = async (options) => {
  /* This pointed at "/agent/orders/active" — the active *orders* endpoint.
     It returns { orders }, never { returns }, so the Assign Returns tab read
     an empty list and always said "No return requests found", however many
     returns were actually waiting for a pickup. */
  const response = await get("/returns/active", options);
  return response.data;
};

// Collect order payment

export const collectOrderPayment = async (orderId, payload) => {
  const response = await axiosInstance.post(
    `/agent/orders/${orderId}/collect-payment`,
    payload,
  );
  return response.data;
};

// Payment history

export const getOrderPayments = async (orderId) => {
  const response = await get(`/agent/orders/${orderId}/payments`);
  return response.data;
};

// Get Due Orders

export const getDueOrders = async () => {
  const response = await get("/agent/orders/due-orders");
  return response.data;
};

// Payment Summary

export const getPaymentSummary = async (options) => {
  const response = await get(
    "/agent/orders/complete-payment-summary",
    options,
  );
  return response.data;
};

// Razorpay / QR payments taken but not applied or refunded automatically
export const getPaymentIssues = async (options) => {
  const response = await get("/agent/orders/payment-issues", options);
  return response.data;
};

export const refundPaymentIssue = async (id) => {
  const response = await axiosInstance.post(
    `/agent/orders/payment-issues/${id}/refund`,
  );
  return response.data;
};

export const resolvePaymentIssue = async (id, note) => {
  const response = await axiosInstance.post(
    `/agent/orders/payment-issues/${id}/resolve`,
    { note },
  );
  return response.data;
};

// Agent Performance based on collection

export const getAgentPerformance = async (options) => {
  const response = await get("/agent/orders/agent-collection-performance", options);
  return response.data;
};

// Create Targets

export const createTarget = async (payload) => {
  const response = await axiosInstance.post("/targets/admin/create", payload);
  return response.data;
};

// Get target performance

export const getTargetPerformance = async (options) => {
  const response = await get("/targets/admin/performance", options);
  return response.data;
};

// Get daily target

export const getDailyTarget = async () => {
  const res = await get("/targets/agent/today-target");
  return res.data;
};

// Get Delivery Partner Profile

export const getDeliveryPartnerProfile = async () => {
  const response = await get("/delivery-partner/profile");
  return response.data;
};

// Get Notifications
export const getNotifications = async () => {
  const res = await get("/api/notifications");
  return res.data;
};

// Read Notifications

export const markNotificationAsRead = async (id) => {
  const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
  return res.data;
};

// Send Custom Notifications

export const sendNotification = async (payload) => {
  const response = await axiosInstance.post("/api/notifications/send", payload);
  return response.data;
};

// Assign location

export const assignLocation = async (payload) => {
  const response = await axiosInstance.post(
    "/agent/store/assign-location",
    payload,
  );
  return response.data;
};

// Agent Dashboard

export const getAgentDashboard = async () => {
  try {
    const res = await get("/agent/dashboard");
    return res.data;
  } catch (error) {
    console.error("Dashboard API error:", error);
    throw error;
  }
};

// Leaderboard

export const getLeaderboard = async () => {
  try {
    const res = await get("/agent/leaderboard");
    return res.data;
  } catch (error) {
    console.error("Leaderboard API error:", error);
    throw error;
  }
};

// Payments RazorPay - Due/Overdue payments

export const createRazorpayOrder = (orderId) => {
  return axiosInstance.post("/agent/orders/razorpay/create", { orderId });
};

export const verifyRazorpayPayment = (data) => {
  return axiosInstance.post("/agent/orders/razorpay/verify", data);
};

// Razorpay - My Cart payments
export const createRazorpayInitialPayment = async (amount) => {
  const response = await axiosInstance.post(
    "/agent/orders/razorpay/create-initial-payment",
    { amount },
  );
  return response.data;
};

export const verifyRazorpayInitialPayment = async (payload) => {
  const response = await axiosInstance.post(
    "/agent/orders/razorpay/verify-initial-payment",
    payload,
  );
  return response.data;
};

// FAQ data

export const getFaqs = async () => {
  try {
    const response = await get("/api/faqs");
    return response.data;
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    throw error;
  }
};

// Download Invoice

export const downloadInvoice = async (orderNo) => {
  try {
    const response = await get(
      `/api/invoice/download/${orderNo}`,
      {
        responseType: "blob",
      },
    );

    return response;
  } catch (error) {
    if (typeof window !== "undefined" && /^\/(?:admin|employee)(?:\/|$)/.test(window.location.pathname)) reportAdminError("Download invoice failed", error);
    else console.error("Download invoice failed:", error);
    throw error;
  }
};

// Incentive List API
export const getIncentiveList = async (options) => {
  try {
    const response = await get("/api/incentives/list", options);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Incentive Payout API
export const payoutIncentive = async (payload) => {
  try {
    const response = await axiosInstance.post(
      "/api/incentives/payout",
      payload,
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Incentive Summary
export const getIncentiveSummary = async () => {
  const res = await get("/api/incentives/summary");
  return res.data;
};

// Incentive History
export const getIncentiveHistory = async () => {
  const res = await get("/api/incentives/history");
  return res.data;
};

// Delete api for employee

export const deleteEmployee = async (employeeId) => {
  try {
    const response = await axiosInstance.delete(
      `/employee/delete/${employeeId}`,
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// DELIVERY PARTNER LIST
export const deliveryPartnerList = async (options) => {
  const res = await get("/delivery-partner/all", options);
  return res.data;
};

// APPROVE DELIVERY PARTNER
export const approveDeliveryPartner = async (id) => {
  const res = await axiosInstance.post(
    `/admin/delivery-partners/${id}/approve`,
  );
  return res.data;
};

// REJECT DELIVERY PARTNER
export const rejectDeliveryPartner = async (id) => {
  const res = await axiosInstance.post(`/admin/delivery-partners/${id}/reject`);
  return res.data;
};

/* ===================== FORGOT / RESET PASSWORD ===================== */

// Agent: identify by agentId or email
export const agentForgotPassword = async ({ agentId, email }) => {
  const response = await axiosInstance.post("/auth/agent/forgot-password", {
    agentId,
    email,
  });

  return response.data;
};

export const agentResetPassword = async ({
  token,
  password,
  confirmPassword,
}) => {
  const response = await axiosInstance.post("/auth/agent/reset-password", {
    token,
    password,
    confirmPassword,
  });

  return response.data;
};

// Delivery partner: identify by registered phone
export const deliveryForgotPassword = async ({ phone }) => {
  const response = await axiosInstance.post(
    "/auth/delivery-partner/forgot-password",
    { phone },
  );

  return response.data;
};

export const deliveryResetPassword = async ({
  token,
  password,
  confirmPassword,
}) => {
  const response = await axiosInstance.post(
    "/auth/delivery-partner/reset-password",
    { token, password, confirmPassword },
  );

  return response.data;
};

/* ===================== EMPLOYEE ACCESS SYNC ===================== */

/**
 * Background poll of the signed-in employee's own record.
 *
 * Deliberately uses a bare axios call instead of axiosInstance: the shared
 * response interceptor sends the browser to /error on any 5xx or network
 * error, which would eject an employee mid-work on a brief backend hiccup.
 * A background check must never do that, so failures are classified and
 * returned instead of thrown.
 */
export const fetchEmployeeAccessState = async () => {
  const token = localStorage.getItem("employeeToken");

  if (!token) return { ok: false, reason: "INVALID_SESSION" };

  try {
    const root = import.meta.env.VITE_API_URL || "http://localhost:8000";

    const response = await axios.get(`${root}/employee/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    return { ok: true, employee: response.data?.employee };
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401 || status === 403 || status === 404) {
      return { ok: false, reason: "INVALID_SESSION" };
    }

    // Offline, timeout or server error — ignore this tick and try again later
    return { ok: false, reason: "TRANSIENT" };
  }
};

/**
 * Current sales-location coverage. Assigning upserts on (agentId, state), so
 * the panel reads this first to show what a save would replace.
 */
export const getSalesLocations = async (agentId, options) => {
  const response = await get("/agent/store/locations", {
    ...options,
    params: agentId ? { agentId } : undefined,
  });
  return response.data;
};

/** All stores, used to show a store's photo and details beside its orders. */
export const getAllStores = async (options) => {
  const response = await get("/agent/store/all", options);
  return response.data;
};

/** Every target that has been created, newest window first. */
export const getAllTargets = async (options) => {
  const response = await get("/targets/admin/all", options);
  return response.data;
};

/** The approved agents a target can be set for (names and IDs only). */
export const getTargetAgents = async (options) => {
  const response = await get("/targets/admin/agents", options);
  return response.data;
};

/** Change a target that has not ended: name, value, reward, mandatory. */
export const updateTarget = async (targetId, payload) => {
  const response = await axiosInstance.patch(
    `/targets/admin/${targetId}`,
    payload,
  );
  return response.data;
};

/** Close a running target now, or withdraw one that has not started. */
export const endTarget = async (targetId) => {
  const response = await axiosInstance.post(`/targets/admin/${targetId}/end`);
  return response.data;
};

/** How many people each role would receive a broadcast. */
export const getNotificationAudience = async (options) => {
  const response = await get("/api/notifications/audience", options);
  return response.data;
};

/** Previously sent broadcasts, with recipient and read counts. */
export const getSentNotifications = async (options) => {
  const response = await get("/api/notifications/sent", options);
  return response.data;
};

/* =====================================================================
   MONTHLY SALES TARGET (admin)
   ===================================================================== */

/** Every agent's month side by side. `month` ("2026-10") for an earlier one. */
export const getSalesTargets = async (month, options) => {
  const response = await get("/targets/admin/sales-target", {
    ...options,
    params: month ? { month } : undefined,
  });
  return response.data;
};

/** One agent in full: own settings, this month, history, change log. */
export const getAgentSalesTarget = async (agentId) => {
  const response = await get(
    `/targets/admin/sales-target/agents/${encodeURIComponent(agentId)}`,
  );
  return response.data;
};

/** Change the settings every agent follows. */
export const saveDefaultSalesTarget = async (payload) => {
  const response = await axiosInstance.put(
    "/targets/admin/sales-target/default",
    payload,
  );
  return response.data;
};

/** Change one agent's own settings. A field sent as null goes back to the default. */
export const saveAgentSalesTarget = async (agentId, payload) => {
  const response = await axiosInstance.put(
    `/targets/admin/sales-target/agents/${encodeURIComponent(agentId)}`,
    payload,
  );
  return response.data;
};

/** Who changed which target, from what to what, and from when. */
export const getSalesTargetChanges = async (agentId) => {
  const response = await get("/targets/admin/sales-target/changes", {
    params: agentId ? { agentId } : undefined,
  });
  return response.data;
};

/* =====================================================================
   PRODUCT-WISE SALES (admin)
   ===================================================================== */

/** { from, to, agentId, productId, groupBy } — dates as YYYY-MM-DD. */
export const getProductSales = async (params, options) => {
  const response = await get("/admin/analytics/product-sales", {
    ...options,
    params,
  });
  return response.data;
};

/* Cash verification: the cash agents record, approved or rejected by the
   office before it counts toward their sales.
   params: { status: PENDING|APPROVED|REJECTED|ALL, from, to, agentId } */
export const getCashPayments = async (params, options) => {
  const response = await get("/admin/cash-payments", { ...options, params });
  return response.data;
};

export const approveCashPayment = async (paymentId, note) => {
  const response = await axiosInstance.post(
    `/admin/cash-payments/${paymentId}/approve`,
    { note },
  );
  return response.data;
};

export const approveCashPayments = async (paymentIds, note) => {
  const response = await axiosInstance.post("/admin/cash-payments/approve", {
    paymentIds,
    note,
  });
  return response.data;
};

export const rejectCashPayment = async (paymentId, reason) => {
  const response = await axiosInstance.post(
    `/admin/cash-payments/${paymentId}/reject`,
    { reason },
  );
  return response.data;
};

/* Deliveries: what the office should look at (a failed delivery, one
   confirmed away from the store, one out for too long), each order's trail
   of who did what, when and where, and the few things the office can do */
export const getDeliveryAlerts = async (options) => {
  const response = await get("/admin/delivery/alerts", options);
  return response.data;
};

export const getDeliveryTrail = async (orderId) => {
  const response = await get(
    `/admin/delivery/orders/${encodeURIComponent(orderId)}/trail`,
  );
  return response.data;
};

// A flagged delivery has been looked at
export const reviewDeliveryEvent = async (eventId) => {
  const response = await axiosInstance.post(
    `/admin/delivery/events/${eventId}/review`,
  );
  return response.data;
};

// Ask the same partner to try a failed delivery again
export const retryDelivery = async (orderId) => {
  const response = await axiosInstance.post(
    `/admin/delivery/orders/${encodeURIComponent(orderId)}/retry`,
  );
  return response.data;
};

// Let one order be marked delivered without the location check
export const allowDeliveryWithoutLocation = async (orderId) => {
  const response = await axiosInstance.post(
    `/admin/delivery/orders/${encodeURIComponent(orderId)}/allow-without-location`,
  );
  return response.data;
};

// Admin only: { blockFarDeliveries, radiusMetres }
export const updateDeliverySettings = async (changes) => {
  const response = await axiosInstance.put("/admin/delivery/settings", changes);
  return response.data;
};
