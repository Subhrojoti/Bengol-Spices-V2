import { api } from "./client";
import type { Faq } from "@/types/api";
import { records } from "@/utils/responseData";

export const faqApi = {
  getFaqs: (signal?: AbortSignal) => api.get<{ success: true; data: Faq[] }>("/api/faqs", { signal }).then((r) => records<Faq>(r.data.data)),
};
