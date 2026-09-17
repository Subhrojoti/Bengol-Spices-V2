import axios from "axios";
import axiosInstance from "./axiosInstance";

const API_BASE_URL = "http://localhost:8000";

export const agentRegistration = async (formData) => {
  const response = axiosInstance.post("/agent/apply", formData, {
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
  });

  return response.data;
};

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

export const agentList = async () => {
  const response = await axiosInstance.get("/admin/agents");
  return response.data;
};

export const approveAgent = (agentId) => {
  return axiosInstance.post(`/admin/agents/${agentId}/approve`);
};

export const rejectAgent = (agentId) => {
  return axiosInstance.post(`/admin/agents/${agentId}/reject`);
};

export const getAgentProfile = async () => {
  const response = await axiosInstance.get("/agent/profile");
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
  const response = await axiosInstance.get("/agent/store/my-stores");
  return response.data;
};

export const fetchProducts = async () => {
  const response = await axiosInstance.get("/products/public/allProduct");
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

  const response = await axiosInstance.get(`/agent/orders/store/${consumerId}`);

  return response.data;
};

export const createProduct = async (formData) => {
  const response = await axiosInstance.post("/products/create", formData);
  return response.data;
};

export const getAllProducts = async () => {
  const response = await axiosInstance.get("/products/all");
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

export const getAllEmployees = async () => {
  const response = await axiosInstance.get("/employee/all");
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

export const getSingleProduct = async (productId) => {
  const response = await axiosInstance.get(`/products/single/${productId}`);
  return response.data;
};

// Dashboard summary

export const getDashboardSummary = async () => {
  const response = await axiosInstance.get("/admin/dashboard-summary/");
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

export const getAllAgentOrders = async () => {
  const response = await axiosInstance.get("/agent/orders/all");
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

export const getAllDeliveryPartners = async () => {
  const response = await axiosInstance.get("/delivery-partner/all");
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
  const response = await axiosInstance.get("/delivery-partner/orders");
  return response.data;
};

// Get assigned Delivery Returns

export const getDeliveryPartnerReturns = async () => {
  const response = await axiosInstance.get("/returns/delivery/assigned");
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
  const response = await axiosInstance.get("/delivery-partner/history");
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
  const response = await axiosInstance.get("/returns/my-returns");
  return response.data;
};

export const getAllReturns = async () => {
  const response = await axiosInstance.get("/returns/all");
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
  const response = await axiosInstance.get("/delivery-partner/dashboard");
  return response.data;
};

// Employee Profile

export const getEmployeeProfile = async () => {
  const response = await axiosInstance.get("/employee/profile");
  return response.data;
};

// Get active orders

export const getActiveOrders = async () => {
  const response = await axiosInstance.get("/agent/orders/active");
  return response.data;
};

// Get active returns

export const getActiveReturns = async () => {
  /* This pointed at "/agent/orders/active" — the active *orders* endpoint.
     It returns { orders }, never { returns }, so the Assign Returns tab read
     an empty list and always said "No return requests found", however many
     returns were actually waiting for a pickup. */
  const response = await axiosInstance.get("/returns/active");
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
  const response = await axiosInstance.get(`/agent/orders/${orderId}/payments`);
  return response.data;
};

// Get Due Orders

export const getDueOrders = async () => {
  const response = await axiosInstance.get("/agent/orders/due-orders");
  return response.data;
};

// Payment Summary

export const getPaymentSummary = async () => {
  const response = await axiosInstance.get(
    "/agent/orders/complete-payment-summary",
  );
  return response.data;
};

// Razorpay / QR payments taken but not applied or refunded automatically
export const getPaymentIssues = async () => {
  const response = await axiosInstance.get("/agent/orders/payment-issues");
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

export const getAgentPerformance = async () => {
  const response = await axiosInstance.get(
    "/agent/orders/agent-collection-performance",
  );
  return response.data;
};

// Create Targets

export const createTarget = async (payload) => {
  const response = await axiosInstance.post("/targets/admin/create", payload);
  return response.data;
};

// Get target performance

export const getTargetPerformance = async () => {
  const response = await axiosInstance.get("/targets/admin/performance");
  return response.data;
};

// Get daily target

export const getDailyTarget = async () => {
  const res = await axiosInstance.get("/targets/agent/today-target");
  return res.data;
};

// Get Delivery Partner Profile

export const getDeliveryPartnerProfile = async () => {
  const response = await axiosInstance.get("/delivery-partner/profile");
  return response.data;
};

// Get Notifications
export const getNotifications = async () => {
  const res = await axiosInstance.get("/api/notifications");
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
    const res = await axiosInstance.get("/agent/dashboard");
    return res.data;
  } catch (error) {
    console.error("Dashboard API error:", error);
    throw error;
  }
};

// Leaderboard

export const getLeaderboard = async () => {
  try {
    const res = await axiosInstance.get("/agent/leaderboard");
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
    const response = await axiosInstance.get("/api/faqs");
    return response.data;
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    throw error;
  }
};

// Download Invoice

export const downloadInvoice = async (orderNo) => {
  try {
    const response = await axiosInstance.get(
      `/api/invoice/download/${orderNo}`,
      {
        responseType: "blob",
      },
    );

    return response;
  } catch (error) {
    console.error("Download invoice failed:", error);
    throw error;
  }
};

// Incentive List API
export const getIncentiveList = async () => {
  try {
    const response = await axiosInstance.get("/api/incentives/list");
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
  const res = await axiosInstance.get("/api/incentives/summary");
  return res.data;
};

// Incentive History
export const getIncentiveHistory = async () => {
  const res = await axiosInstance.get("/api/incentives/history");
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
export const deliveryPartnerList = async () => {
  const res = await axiosInstance.get("/delivery-partner/all");
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
export const getSalesLocations = async (agentId) => {
  const response = await axiosInstance.get("/agent/store/locations", {
    params: agentId ? { agentId } : undefined,
  });
  return response.data;
};

/** All stores, used to show a store's photo and details beside its orders. */
export const getAllStores = async () => {
  const response = await axiosInstance.get("/agent/store/all");
  return response.data;
};

/** Every target that has been created, newest window first. */
export const getAllTargets = async () => {
  const response = await axiosInstance.get("/targets/admin/all");
  return response.data;
};

/** How many people each role would receive a broadcast. */
export const getNotificationAudience = async () => {
  const response = await axiosInstance.get("/api/notifications/audience");
  return response.data;
};

/** Previously sent broadcasts, with recipient and read counts. */
export const getSentNotifications = async () => {
  const response = await axiosInstance.get("/api/notifications/sent");
  return response.data;
};
