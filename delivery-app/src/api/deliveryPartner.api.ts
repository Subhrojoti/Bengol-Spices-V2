import { api } from "./client";
import type { DeliveryPartner, DeliveryDashboardData, DeliveryHistoryData } from "@/types/api";

export const deliveryPartnerApi = {
  getProfile: () =>
    api.get<{ success: true; data: DeliveryPartner }>("/delivery-partner/profile").then((r) => r.data.data),

  getDashboard: () =>
    api
      .get<{ success: true; data: DeliveryDashboardData }>("/delivery-partner/dashboard")
      .then((r) => r.data.data),

  getMyHistory: () =>
    api
      .get<{ success: true; data: DeliveryHistoryData }>("/delivery-partner/history")
      .then((r) => r.data.data),
};
