import { api } from "./client";
import type { Faq } from "@/types/api";

export const faqApi = {
  getFaqs: () => api.get<{ success: true; data: Faq[] }>("/api/faqs").then((r) => r.data.data),
};
