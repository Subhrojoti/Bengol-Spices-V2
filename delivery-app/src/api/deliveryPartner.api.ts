import { api } from "./client";
import type { DeliveryPartner, DeliveryDashboardData, DeliveryHistoryData } from "@/types/api";
import { profileData, dashboardData, historyData } from "@/utils/responseData";

export const deliveryPartnerApi = {
  getProfile: (signal?: AbortSignal) =>
    api.get<{ success: true; data: DeliveryPartner }>("/delivery-partner/profile", { signal }).then((r) => profileData(r.data.data)),

  getDashboard: (signal?: AbortSignal) =>
    api
      .get<{ success: true; data: DeliveryDashboardData }>("/delivery-partner/dashboard", { signal })
      .then((r) => dashboardData(r.data.data)),

  getMyHistory: (signal?: AbortSignal) =>
    api
      .get<{ success: true; data: DeliveryHistoryData }>("/delivery-partner/history", { signal })
      .then((r) => historyData(r.data.data)),
};
