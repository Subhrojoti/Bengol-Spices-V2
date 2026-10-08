// Hand-mirrored from the backend — keep in sync if the backend changes.

export interface Agent {
  _id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  role: "AGENT";
  documents: {
    photo?: string;
    aadhaar?: string;
    pan?: string;
  };
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  } | null;
}

export interface AgentDashboardData {
  summary: {
    totalStoresCreated: number;
    totalCollected: number;
    totalIncentive: number;
    targetAchievedCount: number;
    totalSalesAmount: number;
    totalDue: number;
    totalOrdersDelivered: number;
    totalCancelled: number;
    totalReturns: number;
  };
  monthly: { month: string; sales: number }[];
  // Month-over-month sales change in percent. The backend sends it as a
  // string from toFixed(), or a bare number for the 0 / 100 edge cases.
  growth?: { salesGrowth?: number | string };
}

export interface LeaderboardEntry {
  agentId: string;
  name: string;
  state: string;
  profileImage?: string;
  earnedAmount: number;
  sales: number;
  ordersDelivered: number;
  completedTargets: number;
  // Extra fields the backend already returns; optional so older responses still fit.
  rank?: number;
  collected?: number;
  returns?: number;
  storesCreated?: number;
}

// ---------- Stores ----------

export type StoreType = "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";

export interface Store {
  _id: string;
  consumerId: string;
  storeName: string;
  ownerName: string;
  phone: string;
  storeType: StoreType;
  status: "ACTIVE" | "INACTIVE";
  deliveryCode: string;
  address: {
    state: string;
    city: string;
    street: string;
    pincode: string;
  };
  location: { latitude: number; longitude: number };
  image: { url: string };
}

// ---------- Products ----------

export interface PublicProduct {
  _id: string;
  name: string;
  title?: string;
  category: string;
  description?: string;
  uom: string;
  minOrderQty: number;
  gstPercentage: number;
  price?: number;
  discountPrice?: number;
  // 🔥 FIX: these are FLAT fields on the product, not nested under a
  // "pricing" object as originally assumed — confirmed against the real
  // controller's .select() field list.
  retailerPrice: number | null;
  wholesalerPrice: number | null;
  distributorPrice: number | null;
  images?: { front?: { url: string }; back?: { url: string } };
  // Present only on the store-priced catalogue (/agent/store/:consumerId/products)
  effectivePrice?: number | null;
  priceSource?: "location" | "default" | null;
  locationPricing?: { retailerPrice: boolean; wholesalerPrice: boolean; distributorPrice: boolean };
}

export interface CartItem {
  productId: string;
  name: string;
  uom: string;
  unitPrice: number;
  quantity: number;
  minOrderQty: number;
  image?: string;
}

// ---------- Orders ----------

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

export interface Order {
  _id: string;
  orderId: string;
  consumerId: string;
  store: string;
  agentId: string;
  products: OrderProduct[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  // 🔥 "QR" added alongside the existing modes for the new QR payment feature.
  paymentMode: "CASH" | "ONLINE" | "QR" | "MIXED";
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  // 🔥 FIX: matches the real Order schema exactly — deliveryAddress is a
  // required, always-populated field (confirmed from Order.js), unlike the
  // separate top-level storeName/storeAddress fields this used to guess at.
  deliveryAddress?: {
    storeName: string;
    ownerName: string;
    phone: string;
    state: string;
    city: string;
    street: string;
    pincode: string;
  };
  orderLocation?: {
    latitude: number;
    longitude: number;
  };
}

// ---------- Targets ----------

export type TargetType = "STORE_CREATION" | "ORDER" | "PAYMENT";

export interface Target {
  _id: string;
  name: string;
  type: TargetType;
  targetValue: number;
  rewardAmount: number;
  startDate: string;
  endDate: string;
}

export interface TargetProgress {
  targetId: string;
  achievedValue: number;
  earnedAmount: number;
  isCompleted: boolean;
}

// ---------- Wallet / Incentives ----------

export interface IncentiveLedgerEntry {
  _id: string;
  type: "EARNING" | "PAYOUT";
  source?: "TARGET" | "ORDER" | "MANUAL";
  amount: number;
  status?: "COMPLETED" | "PENDING";
  createdAt: string;
  note?: string;
}

// ---------- Notifications ----------

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

// ---------- FAQ ----------

export interface Faq {
  _id: string;
  question: string;
  answer: string;
  category: "PAYMENT" | "ORDER" | "DELIVERY" | "GENERAL";
}

// ---------- Returns ----------

export type ReturnStatus =
  | "INITIATED"
  | "PICKUP_ASSIGNED"
  | "PICKED_UP"
  | "RECEIVED_AT_WAREHOUSE"
  | "COMPLETED"
  | "REFUND_PROCESSED"
  | "CANCELLED";

export interface ReturnRequest {
  _id: string;
  returnId: string;
  orderId: string;
  reason: string;
  status: ReturnStatus;
  createdAt: string;
}
