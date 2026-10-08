import { useQuery } from "@tanstack/react-query";
import { deliveryPartnerApi } from "@/api/deliveryPartner.api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: deliveryPartnerApi.getProfile,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: deliveryPartnerApi.getDashboard,
  });
}

export function useDeliveryHistory() {
  return useQuery({
    queryKey: ["history"],
    queryFn: deliveryPartnerApi.getMyHistory,
  });
}
