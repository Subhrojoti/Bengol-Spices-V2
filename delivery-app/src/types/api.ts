// Hand-mirrored from the backend — keep in sync if the backend changes.

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

export interface DeliveryPartner {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address: {
    state: string;
    city: string;
    street: string;
    pincode: string;
  };
  documents: {
    idType: "AADHAAR" | "DRIVING_LICENSE";
    idNumber: string;
    documentUrl: string;
  };
  isOnline: boolean;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  role: "DELIVERY_PARTNER";
  bankDetails: BankDetails | null;
}

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "ASSIGNED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderProduct {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  totalPrice: number;
  gstPercentage: number;
  image?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  changedAt: string;
  changedBy: { id: string; role: string };
}

// The store's delivery code is deliberately not part of this: the backend
// does not send it. The store owner reads it out and the partner types it in.
export interface PopulatedStore {
  _id: string;
  storeName: string;
  address: {
    state: string;
    city: string;
    street: string;
    pincode: string;
  };
  location: { latitude: number; longitude: number };
}

export interface AssignedOrder {
  _id: string;
  orderId: string;
  consumerId: string;
  // Missing on a few older orders, and null if the store record was removed
  store?: PopulatedStore | null;
  agentId: string;
  products: OrderProduct[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: "CASH" | "ONLINE" | "MIXED" | "QR";
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  orderLocation: { latitude: number; longitude: number };
  deliveryAddress: {
    storeName: string;
    ownerName: string;
    phone: string;
    state: string;
    city: string;
    street: string;
    pincode: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDashboardData {
  summary: {
    totalDelivered: number;
    totalReturnsHandled: number;
    totalPendingPickups: number;
  };
  monthlyDeliveryDistribution: {
    month: string;
    delivered: number;
    returns: number;
  }[];
  yearlyComparison: { year: number; delivered: number }[];
  meta: { generatedAt: string };
}

export type ReturnStatus =
  | "INITIATED"
  | "PICKUP_ASSIGNED"
  | "PICKED_UP"
  | "RECEIVED_AT_WAREHOUSE"
  | "COMPLETED"
  | "REFUND_PROCESSED"
  | "CANCELLED";

export interface ReturnStatusHistoryEntry {
  status: ReturnStatus;
  changedAt: string;
  changedBy: { id: string; name: string; role: string };
  note?: string;
}

export interface AssignedReturn {
  _id: string;
  returnId: string;
  orderId: string;
  consumerId: string;
  agentId: string;
  reason: string;
  status: ReturnStatus;
  statusHistory: ReturnStatusHistoryEntry[];
  pickup: {
    partnerId: string;
    assignedAt: string;
    pickedUpAt?: string;
  };
  createdAt: string;
  storeDetails: { storeName: string; ownerName: string; phone: string } | null;
  pickupLocation: { latitude: number; longitude: number; address: string } | null;
  items: OrderProduct[];
  payment: {
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    paymentMode: string;
  } | null;
  refundStatus: {
    amount: number;
    status: "PROCESSED" | "PENDING";
    method: string | null;
  };
}

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  recipientId: string;
  recipientModel: string;
  type: "SYSTEM" | "CUSTOM";
  isRead: boolean;
  createdAt: string;
}

export interface Faq {
  _id: string;
  question: string;
  answer: string;
  category: "PAYMENT" | "ORDER" | "DELIVERY" | "GENERAL";
}

// ---------- History ----------

export interface DeliveryHistoryData {
  deliveredOrders: AssignedOrder[];
  completedReturns: AssignedReturn[];
}
