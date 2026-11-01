import { api } from "./client";
import type { Order, OrderProduct } from "@/types/api";
export interface EditProduct { productId: string; name: string; uom: string; unitPrice: number; minOrderQty: number; availableStock: number }
export interface EditDetails { order: Order; products: EditProduct[] }
export interface EditAttempt { clientRequestId: string; expectedRevision: number; expectedTotal: number; products: { productId: string; quantity: number }[] }
export interface OrderChange { _id: string; revision: number; agentId: string; createdAt: string; before: { products: OrderProduct[]; totalAmount: number }; after: { products: OrderProduct[]; totalAmount: number } }
export const orderEditingApi = {
  details: (orderId: string) => api.get<EditDetails>(`/agent/orders/mine/${encodeURIComponent(orderId)}/edit`).then(r => r.data),
  save: (orderId: string, body: EditAttempt) => api.put(`/agent/orders/mine/${encodeURIComponent(orderId)}/edit`, body).then(r => r.data),
  history: (orderId: string, page: number) => api.get<{ history: OrderChange[]; pages: number }>(`/agent/orders/mine/${encodeURIComponent(orderId)}/modifications`, { params: { page } }).then(r => r.data),
};
