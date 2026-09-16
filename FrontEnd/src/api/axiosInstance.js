import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

/* 🔹 GET TOKEN BASED ON CURRENT ROUTE */
const getTokenByPath = () => {
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    return localStorage.getItem("adminToken");
  }

  if (path.startsWith("/employee")) {
    return localStorage.getItem("employeeToken");
  }

  if (path.startsWith("/delivery")) {
    return localStorage.getItem("deliveryToken");
  }

  return localStorage.getItem("agentToken");
};

/* 🔹 REQUEST INTERCEPTOR */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getTokenByPath();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* 🔴 RESPONSE INTERCEPTOR (GLOBAL ERROR HANDLING) */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // 🔐 Unauthorized / Token expired
    if (status === 401) {
      console.warn("Unauthorized");

      // Optional: clear token
      localStorage.clear();

      // window.location.href = "/login";
    }

    // ⛔ Forbidden
    else if (status === 403) {
      console.warn("Forbidden access");
    }

    // 🔥 Server error → show full screen error page
    else if (status >= 500) {
      console.error("Server error - Redirecting to error page");

      if (window.location.pathname !== "/error") {
        window.location.href = "/error";
      }
    }

    // 🌐 Network error (backend down / no internet)
    else if (!error.response) {
      console.error("Network error");

      if (window.location.pathname !== "/error") {
        window.location.href = "/error";
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
