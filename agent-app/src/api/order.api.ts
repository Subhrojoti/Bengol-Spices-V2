import { api } from "./client";
import { unwrapList } from "./unwrap";
import type { Order } from "@/types/api";

export interface RazorpaySessionResponse {
  razorpayOrderId: string;
  amount: number;
  key: string;
}

export interface QrSessionResponse {
  qrCodeId: string;
  imageUrl: string;
  amount: number;
}

export interface QrStatusResponse {
  paid: boolean;
  status: "active" | "closed";
  amountReceived: number;
}

export interface PlaceOrderInput {
  consumerId: string;
  products: { productId: string; name: string; uom: string; quantity: number; unitPrice: number }[];
  paymentMode: "CASH" | "ONLINE" | "QR";
  paidAmount: number;
  latitude?: number;
  longitude?: number;
  /** For a cash order: the same value on a retry gets the order already placed, not a second one. */
  requestId?: string;
}

export const orderApi = {
  getMyOrders: (): Promise<Order[]> => api.get("/agent/orders/my-orders").then((r) => unwrapList<Order>(r.data)),

  getOrdersByStore: (consumerId: string): Promise<Order[]> =>
    api.get(`/agent/orders/store/${encodeURIComponent(consumerId)}`).then((r) => unwrapList<Order>(r.data)),

  getDueOrders: (): Promise<Order[]> => api.get("/agent/orders/due-orders").then((r) => unwrapList<Order>(r.data)),

  /** One of the agent's own orders, without downloading the whole list. */
  getOrder: (orderId: string): Promise<Order> =>
    api.get<{ success: true; order: Order }>(`/agent/orders/mine/${encodeURIComponent(orderId)}`).then((r) => {
      if (!r.data?.order) throw new Error("Couldn't find this order.");
      return r.data.order;
    }),

  placeOrder: (input: PlaceOrderInput) =>
    api.post<{ success: true; orderId: string }>("/agent/orders", input).then((r) => r.data),

  // ---------- Existing Razorpay checkout flow ----------

  createInitialPayment: (amount: number) =>
    api
      .post<{ success: true } & RazorpaySessionResponse>("/agent/orders/razorpay/create-initial-payment", { amount })
      .then((r) => r.data),

  createDuePayment: (orderId: string, amount: number) =>
    api
      .post<{ success: true } & RazorpaySessionResponse>("/agent/orders/razorpay/create", { orderId, amount })
      .then((r) => r.data),

  verifyInitialPaymentAndPlaceOrder: (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
    orderPayload: PlaceOrderInput;
  }) =>
    api
      .post<{ success: true; orderId: string }>("/agent/orders/razorpay/verify-initial-payment", params)
      .then((r) => r.data),

  verifyRazorpayDuePayment: (params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; orderId: string; amount: number }) =>
    api.post<{ success: true; message: string }>("/agent/orders/razorpay/verify", params).then((r) => r.data),

  // ---------- QR Code payment flow ----------

  createInitialPaymentQr: (amount: number) =>
    api
      .post<{ success: true } & QrSessionResponse>("/agent/orders/razorpay/create-initial-qr", { amount })
      .then((r) => r.data),

  createDuePaymentQr: (orderId: string) =>
    api
      .post<{ success: true } & QrSessionResponse>("/agent/orders/razorpay/create-due-qr", { orderId })
      .then((r) => r.data),

  checkQrPaymentStatus: (qrCodeId: string) =>
    api
      .get<{ success: true } & QrStatusResponse>(`/agent/orders/razorpay/qr-status/${encodeURIComponent(qrCodeId)}`)
      .then((r) => r.data),

  verifyQrAndPlaceOrder: (qrCodeId: string, amount: number, orderPayload: PlaceOrderInput) =>
    api
      .post<{ success: true; orderId: string }>("/agent/orders/razorpay/verify-qr-and-place-order", {
        qrCodeId,
        amount,
        orderPayload,
      })
      .then((r) => r.data),

  verifyDueQrPayment: (qrCodeId: string, orderId: string) =>
    api
      .post<{ success: true; message: string }>("/agent/orders/razorpay/verify-due-qr", { qrCodeId, orderId })
      .then((r) => r.data),

  updateDeliveryStatus: (orderId: string, status: string) =>
    api.put<{ success: true; message: string }>(`/agent/orders/${encodeURIComponent(orderId)}/delivery-status`, { status }).then((r) => r.data),

  collectCashPayment: (orderId: string, amount: number) =>
    api
      .post<{ success: true; message: string }>(`/agent/orders/${encodeURIComponent(orderId)}/collect-payment`, {
        amount,
        method: "CASH",
        paymentMode: "CASH",
      })
      .then((r) => r.data),
};
