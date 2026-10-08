import { api } from "./client";
import { unwrapList } from "./unwrap";
import type { Faq } from "@/types/api";

export const faqApi = {
  getFaqs: (): Promise<Faq[]> => api.get("/api/faqs").then((r) => unwrapList<Faq>(r.data)),
};
