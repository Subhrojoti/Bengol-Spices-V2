import { useQuery } from "@tanstack/react-query";
import { deliveryPartnerApi } from "@/api/deliveryPartner.api";
import { useIsFocused } from "expo-router";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => deliveryPartnerApi.getProfile(signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboard() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => deliveryPartnerApi.getDashboard(signal),
    enabled: focused,
  });
}

export function useDeliveryHistory(enabled = true) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["history"],
    queryFn: ({ signal }) => deliveryPartnerApi.getMyHistory(signal),
    enabled: focused && enabled,
    gcTime: 60 * 1000,
  });
}
