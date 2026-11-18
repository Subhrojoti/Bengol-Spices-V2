import { useQuery } from "@tanstack/react-query";
import { faqApi } from "@/api/faq.api";
import { useIsFocused } from "expo-router";

export function useFaqs() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["faqs"],
    queryFn: ({ signal }) => faqApi.getFaqs(signal),
    enabled: focused,
    staleTime: 60 * 60 * 1000,
  });
}
