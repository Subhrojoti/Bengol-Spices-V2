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

// HORECA: hotels, restaurants and caterers
export type StoreType = "RETAILER" | "WHOLESALER" | "DISTRIBUTOR" | "HORECA";

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
  // Absent on a server that has not been updated yet
  horecaPrice?: number | null;
  images?: { front?: { url: string }; back?: { url: string } };
  // Present only on the store-priced catalogue (/agent/store/:consumerId/products)
  effectivePrice?: number | null;
  priceSource?: "location" | "default" | null;
  locationPricing?: { retailerPrice: boolean; wholesalerPrice: boolean; distributorPrice: boolean; horecaPrice?: boolean };
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
  /** How much of `paidAmount` is cash the office has not verified yet, or has rejected (see utils/paymentState). */
  cashVerification?: {
    pending: number;
    pendingCount: number;
    rejected: number;
    rejectedCount: number;
    rejectionReason: string | null;
  };
}

// ---------- Targets ----------

export type TargetType = "STORE_CREATION" | "ORDER" | "PAYMENT";

// How long a target runs from its start: a day, a week or a month
export type TargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Target {
  _id: string;
  name: string;
  type: TargetType;
  targetValue: number;
  // 0 when the target carries no reward
  rewardAmount: number;
  startDate: string;
  endDate: string;
  // The rest are absent on a server that has not been updated yet
  period?: TargetPeriod;
  /** Expected of the agent, with or without a reward. */
  isMandatory?: boolean;
  /** What an ORDER target counts: every unit ordered, or each order as one. */
  orderMetric?: "UNITS" | "ORDERS";
  /** Set for this agent in particular, not for every agent. */
  isIndividual?: boolean;
}

export interface TargetProgress {
  targetId: string;
  achievedValue: number;
  earnedAmount: number;
  isCompleted: boolean;
  completedAt?: string | null;
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

// ---------- Monthly sales target ----------

// One line of a sales target: what was asked, what was collected against it
export interface SalesTargetRow {
  target: number;
  achieved: number;
  remaining: number;
  /** 0–100, whole. 100 only once the target is met. */
  percent: number;
  status: "ACHIEVED" | "IN_PROGRESS" | "DAY_OFF" | "NO_TARGET" | "NOT_ACHIEVED";
  /** The month's target was already met before this day or week began. */
  targetMet?: boolean;
}

export type IncentiveStatus = "EARNED" | "IN_PROGRESS" | "UNLOCKED" | "LOCKED" | "NOT_OFFERED";

/**
 * The agent's mandatory sales target for a month, as the server works it
 * out. "Sales" are payments actually collected, counted on the day they
 * come in: a ₹10,000 order placed with ₹1 down is ₹1 of sales until the
 * rest is collected.
 *
 * The daily and weekly lines are that one monthly target, not targets of
 * their own. Each is set afresh (today's each morning, the week's on its
 * first day) from what is still to be collected and the working days left,
 * and then stays fixed for the day or week.
 */
export interface SalesTargetView {
  month: string; // "2026-10"
  monthLabel: string; // "October 2026"
  closed: boolean;
  /** False when no mandatory target has been set for the month. */
  hasTarget: boolean;
  /** Collected in the month. */
  sales: number;
  /** How many orders that money was collected on, and in how many payments. */
  orders: number;
  payments: number;
  /** Cash taken this month that is not in `sales`: the office has not verified it yet, or rejected it. */
  verification?: CashWaiting;
  /** Collected this month on orders from earlier months: dues cleared, not part of `sales`. */
  earlierDues?: { collected: number; payments: number };
  mandatory: SalesTargetRow & { isAchieved: boolean; achievedAt: string | null };
  breakdown: {
    workingDays: number;
    /** Monthly target ÷ working days: what a day asked when the month began. */
    baseDailyTarget: number;
    /** What a working day asks now: what is left ÷ working days left. */
    dailyTarget: number;
    workingDaysLeft: number;
    /** The next day there is a target for ("2026-10-12"); today on a working day. */
    nextWorkingDay: string | null;
    daily: (SalesTargetRow & { date: string; isWorkingDay: boolean }) | null;
    weekly: (SalesTargetRow & { from: string; to: string; workingDays: number }) | null;
  };
  incentive: {
    /** On offer this month (or already earned in it). */
    offered: boolean;
    /** Open to the agent: only once the mandatory target is achieved. */
    unlocked: boolean;
    started: boolean;
    target: number;
    reward: number;
    /** Sales made above the mandatory target. */
    achieved: number;
    remaining: number;
    percent: number;
    isEarned: boolean;
    earnedAt: string | null;
    amountEarned: number;
    status: IncentiveStatus;
  };
}

export interface SalesTargetHistoryRow {
  month: string;
  monthLabel: string;
  closed: boolean;
  mandatoryTarget: number;
  /** Collected in the month. */
  sales: number;
  orders: number;
  payments: number;
  /** Cash from the month still waiting for the office, and cash it rejected. */
  awaitingVerification?: number;
  awaitingVerificationCount?: number;
  rejected?: number;
  percent: number;
  status: "ACHIEVED" | "IN_PROGRESS" | "NOT_ACHIEVED" | "NO_TARGET";
  completedAt: string | null;
  workingDays: number;
  incentiveOffered: boolean;
  incentiveTarget: number | null;
  incentiveReward: number | null;
  incentiveStatus: IncentiveStatus;
  incentiveEarned: number;
  incentiveEarnedAt: string | null;
}

// ---------- Cash verification ----------

/* Cash an agent records counts toward their sales only once the office has
   verified that it reached the company. Online and QR payments are
   confirmed by the gateway and never wait. */
export type CashVerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CashWaiting {
  pending: number;
  pendingCount: number;
  oldestPending: string | null;
  rejected: number;
  rejectedCount: number;
}

export interface CashPayment {
  id: string;
  orderId: string;
  storeName: string | null;
  amount: number;
  method: string;
  collectedAt: string;
  status: CashVerificationStatus;
  decidedAt: string | null;
  /** Why the office rejected it. */
  reason: string | null;
  /** The month it counts for ("2026-10"): always the one it was collected in. */
  countsFor: string;
  /** False for a due from an earlier month's order: verified like any cash, but in no sales target. */
  countsTowardTarget: boolean;
}

export interface CashPaymentsSummary {
  pending: { count: number; amount: number };
  approved: { count: number; amount: number };
  rejected: { count: number; amount: number };
}

export interface CashPayments {
  summary: CashPaymentsSummary;
  payments: CashPayment[];
}

// ---------- Product-wise sales ----------

/* Three figures, kept apart. ORDER VALUE and quantity: what was ordered in
   the period. COLLECTED: the payments received in the period, shared across
   each order's products by value; this is what the sales target counts.
   OUTSTANDING: what is still owed on the period's orders. */
export interface ProductSalesRow {
  productId: string | null;
  name: string;
  uom: string;
  quantity: number;
  orderValue: number;
  collected: number;
  outstanding: number;
  orders: number;
  /** This product's part of everything ordered in the period, in per cent. */
  share: number;
}

export interface ProductSalesReport {
  from: string;
  to: string;
  totals: {
    orderValue: number;
    collected: number;
    outstanding: number;
    /** The part of `collected` on orders placed in the same month: what the sales target counts. */
    towardTarget: number;
    /** The rest of it: dues from earlier months being cleared. */
    earlierDues: number;
    /** Cash taken in the period that the office has not verified yet: not in `collected`. */
    awaitingVerification: number;
    quantity: number;
    orders: number;
    productsSold: number;
  };
  products: ProductSalesRow[];
}
