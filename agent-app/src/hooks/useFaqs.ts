import { useQuery } from "@tanstack/react-query";
import { faqApi } from "@/api/faq.api";

export function useFaqs() {
  return useQuery({
    queryKey: ["faqs"],
    queryFn: faqApi.getFaqs,
    staleTime: 60 * 60 * 1000,
  });
}
