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
}

export const orderApi = {
  getMyOrders: (): Promise<Order[]> => api.get("/agent/orders/my-orders").then((r) => unwrapList<Order>(r.data)),

  getOrdersByStore: (consumerId: string): Promise<Order[]> =>
    api.get(`/agent/orders/store/${consumerId}`).then((r) => unwrapList<Order>(r.data)),

  getDueOrders: (): Promise<Order[]> => api.get("/agent/orders/due-orders").then((r) => unwrapList<Order>(r.data)),

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
      .get<{ success: true } & QrStatusResponse>(`/agent/orders/razorpay/qr-status/${qrCodeId}`)
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
    api.put<{ success: true; message: string }>(`/agent/orders/${orderId}/delivery-status`, { status }).then((r) => r.data),

  collectCashPayment: (orderId: string, amount: number) =>
    api
      .post<{ success: true; message: string }>(`/agent/orders/${orderId}/collect-payment`, {
        amount,
        method: "CASH",
        paymentMode: "CASH",
      })
      .then((r) => r.data),
};
