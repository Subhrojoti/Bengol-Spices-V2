import { workspaceFixture } from "./order-workspace-fixtures.mjs";
// Synthetic DTOs only. Browser tests intercept every external request so no
// production API, account, payment or customer record can be touched.
export const tokenFor = (role = "ADMIN", extra = {}) => [
  btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  btoa(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600, ...extra })),
  "synthetic-signature",
].join(".");

const id = (n) => n.toString(16).padStart(24, "0");
export const agents = Array.from({ length: 120 }, (_, i) => ({
  _id: id(i + 1), agentId: `BS2026-${String(i + 1).padStart(3, "0")}`, name: `Test Agent ${i + 1}`,
  email: `agent${i + 1}@example.invalid`, phone: String(9000000000 + i), status: i === 0 ? "PENDING" : "APPROVED",
  accessStatus: "ACTIVE", createdAt: "2026-10-01T06:00:00Z", address: "Synthetic address",
  addressDetails: { state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" },
  documents: { aadhaar: "https://assets.example.invalid/document.png", pan: "https://assets.example.invalid/document.png", photo: "https://assets.example.invalid/photo.png" },
}));
export const stores = Array.from({ length: 1000 }, (_, i) => ({
  _id: id(i + 1001), consumerId: `CS2026-${String(i + 1).padStart(4, "0")}`, storeName: `Test Store ${i + 1}`,
  ownerName: `Test Owner ${i + 1}`, phone: String(9100000000 + i), status: "ACTIVE", registeredBy: agents[i % agents.length].agentId,
  currentAgentId: agents[i % agents.length].agentId, storeType: "RETAILER", createdAt: "2026-10-01T06:00:00Z",
  address: { state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, location: { latitude: 22.5, longitude: 88.3 },
}));
export const products = Array.from({ length: 80 }, (_, i) => ({
  _id: id(i + 3001), name: `Test Spice ${i + 1}`, title: `Test Spice ${i + 1}`, category: "Spice", sku: `TEST-${i + 1}`,
  uom: "packet", price: 100, retailerPrice: 80, wholesalerPrice: 75, stock: 100, minOrderQty: 1, gstPercentage: 5,
  status: "ACTIVE", description: "<p>Safe description</p>", createdAt: "2026-10-01T06:00:00Z",
  images: { front: { url: "https://assets.example.invalid/product.png", publicId: "front" }, back: { url: "https://assets.example.invalid/product.png", publicId: "back" } },
}));
export const employees = [{ _id: id(16001), employeeId: "EMP2026-001", name: "Test Employee", email: "employee@example.invalid", role: "EMPLOYEE", isActive: true, createdAt: "2026-10-01T06:00:00Z", permissions: { canGetAllOrders: true } }];
export const partners = [{ _id: id(17001), name: "Test Partner", phone: "9000000999", email: "partner@example.invalid", status: "APPROVED", isActive: true, vehicleType: "BIKE", documents: [] }];
export const salesTargets = {
  agents: [], month: "2026-10", currentMonth: "2026-10", months: ["2026-10", "2026-09"], monthLabel: "October 2026", nextMonthLabel: "November 2026", isCurrent: true,
  defaults: { monthlyTarget: 100000, workingDays: null, weeklyOffDays: [0], holidays: [], incentive: { enabled: false, target: 20000, reward: 2000 } },
  summary: { agents: 0, achieved: 0, approaching: 0, onTrack: 0, behind: 0, noTarget: 0, totalTarget: 0, totalSales: 0, incentiveEarned: 0 },
};
export const orders = Array.from({ length: 2000 }, (_, i) => {
  const store = stores[i % stores.length];
  return { _id: id(i + 5001), orderId: `ORD2026-${String(i + 1).padStart(4, "0")}`, consumerId: store.consumerId,
    store: store._id, agentId: store.registeredBy, status: ["PLACED", "CONFIRMED", "ASSIGNED", "DELIVERED"][i % 4],
    totalAmount: 200, paidAmount: 50, dueAmount: 150, paymentStatus: "PARTIAL", paymentMode: "CASH",
    createdAt: "2026-10-25T06:00:00Z", dueDate: "2026-10-30T06:00:00Z", orderLocation: store.location,
    products: [{ productId: products[i % products.length]._id, name: products[i % products.length].name, quantity: 2, uom: "packet", unitPrice: 100, totalPrice: 200 }],
    deliveryAddress: { storeName: store.storeName, ownerName: store.ownerName, phone: store.phone, ...store.address },
    statusHistory: [{ status: "PLACED", changedAt: "2026-10-25T06:00:00Z" }], delivery: {},
  };
});
export const cash = Array.from({ length: 150 }, (_, i) => ({
  id: id(i + 9001), _id: id(i + 9001), orderId: orders[i].orderId, consumerId: orders[i].consumerId, agentId: orders[i].agentId,
  agentName: agents[i % agents.length].name, order: { storeName: stores[i % stores.length].storeName, city: "Kolkata", totalAmount: 200, dueAmount: 150 },
  amount: 50, method: "CASH", status: "PENDING", collectedAt: "2026-10-25T06:00:00Z", createdAt: "2026-10-25T06:00:00Z", verification: { status: "PENDING", history: [] },
  agent: { name: agents[i % agents.length].name, agentId: agents[i % agents.length].agentId }, store: stores[i % stores.length],
}));

export const fixtureResponse = (path, method = "GET") => {
  path = path.replace(/\/$/, "");
  if (path === "/auth/admin/login") return { success: true, token: tokenFor() };
  if (method !== "GET") return undefined;
  if (path === "/admin/agents") return { success: true, agents };
  if (path === "/admin/dashboard-summary") {
    const period = { collected: 7500, orderValue: 10000, outstanding: 2500, awaitingVerification: 1000, rejected: 0, ordersPlaced: 50, from: "2026-10-25T18:30:00Z" };
    return { success: true, meta: { year: 2026, generatedAt: "2026-10-26T06:00:00Z" }, data: {
      counts: { orders: orders.length, agents: agents.length, stores: stores.length, products: products.length, employees: 5, deliveryPartners: 5 },
      orderStats: { inProgress: 1500, delivered: 500, cancelled: 0, pendingPayments: 2000, totalReturns: 0 }, financials: {},
      salesOverview: { daily: period, weekly: period, monthly: period, allTime: period, activeAgents: 119, activeStores: 1000 },
      charts: { revenue: Array.from({ length: 12 }, (_, i) => ({ month: String(i + 1), sales: 1000, profit: 500 })) },
      insights: { topProducts: products.slice(0, 5).map((p) => ({ _id: p.name, revenue: 100 })), topAgents: [], stateSales: [] },
    } };
  }
  if (path === "/admin/attention") return { success: true, data: {} };
  if (path === "/agent/store/all") return { success: true, stores };
  if (path === "/agent/orders/all" || path === "/agent/orders/active") return { success: true, orders, data: orders };
  if (path === "/agent/orders/agent-collection-performance") return { success: true, data: [] };
  if (path === "/agent/orders/complete-payment-summary") return { success: true, data: orders.map((o, i) => ({ ...o, store: stores[i % stores.length].storeName, phone: stores[i % stores.length].phone, city: "Kolkata", state: "WEST BENGAL", orderStatus: o.status, agent: agents[i % agents.length], payments: [] })) };
  if (path === "/admin/cash-payments") return { success: true, data: cash, summary: { pending: { count: cash.length, amount: 7500 }, approvedThisMonth: {}, rejected: {}, late: {} } };
  if (path === "/employee/all") return { success: true, employees };
  if (path === "/delivery-partner/all") return { success: true, data: partners, partners };
  if (path === "/products/all" || path === "/products/public/allProduct") return { success: true, products, data: products };
  if (path.startsWith("/products/single/")) return { success: true, product: products.find((p) => p._id === path.split("/").at(-1)) || products[0] };
  if (path === "/agent/store/locations") return { success: true, locations: [{ _id: id(14001), agentId: agents[1].agentId, state: "WEST BENGAL", city: "KOLKATA", pincodes: ["700001"], priceOverrides: [] }] };
  if (path.startsWith("/admin/analytics/product-sales")) return { success: true, from: "2026-10-01", to: "2026-10-26", data: { totals: { orderValue: 16000, collected: 8000, quantity: 160, productsSold: products.length }, products: products.map((p) => ({ productId: p._id, name: p.name, uom: p.uom, quantity: 2, orderValue: 200, collected: 100, outstanding: 100, orders: 1, share: 1.25, collectedShare: 1.25 })), trend: [{ period: "2026-10-25", orderValue: 16000, collected: 8000, quantity: 160 }], agents: [] } };
  if (path === "/api/incentives/list") return { success: true, data: agents.map((a) => ({ agentId: a.agentId, name: a.name, totalEarned: 1000, totalPaid: 100, pending: 900 })), summary: { totalEarned: 120000, totalPaid: 12000, pending: 108000 } };
  if (path === "/api/incentives/summary") return { success: true, data: { totalEarned: 1000, totalPaid: 100, pending: 900 } };
  if (path === "/api/notifications/audience") return { success: true, audience: { Agent: 119, Employee: 5, DeliveryPartner: 5 } };
  if (path === "/api/notifications/sent") return { success: true, data: [] };
  if (path === "/api/notifications") return [];
  if (path === "/admin/delivery/alerts") return { success: true, data: { couldNotDeliver: [], locationFlags: [], outForDeliveryLong: [], settings: { radiusMetres: 100, blockFarDeliveries: true } } };
  if (path === "/agent/orders/payment-issues") return { success: true, data: [] };
  if (path.startsWith("/returns/")) return { success: true, data: [], returns: [] };
  if (path === "/targets/admin/performance") return { success: true, data: [], targets: [] };
  if (path === "/targets/admin/agents") return { success: true, agents, data: agents };
  if (path === "/targets/admin/sales-target") return { success: true, data: salesTargets };
  if (path === "/targets/admin/sales-target/changes") return { success: true, data: [] };
  if (path === "/targets/admin/all" || path === "/targets/admin/list") return { success: true, data: [], targets: [] };
  if (path === "/admin/store-management") return { success: true, stores: stores.slice(0, 30), total: stores.length, page: 1, pages: 34 };
  if (path === "/admin/management-audit") return { success: true, data: [] };
  return undefined;
};

export async function installFixtures(context, { authenticated = true, delay = 40, overrides = {}, role = "ADMIN", quietFonts = true } = {}) {
  const requests = [], unknown = [];
  if (authenticated) await context.addInitScript(({ token, role }) => {
    if (localStorage.getItem("__adminFixtureSeeded")) return;
    localStorage.setItem("__adminFixtureSeeded", "true");
    localStorage.setItem(role === "ADMIN" ? "adminToken" : "employeeToken", token);
    localStorage.setItem("role", role);
  }, { token: tokenFor(role), role });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) && url.port !== "8000") return route.continue();
    // Offline font fallback in both comparisons; avoid an expected abort
    // appearing as an application console error in functional regressions.
    if (url.hostname === "fonts.googleapis.com" && quietFonts) return route.fulfill({ contentType: "text/css", body: "" });
    if (url.hostname === "countriesnow.space") return route.fulfill({ json: url.pathname.endsWith("/states") ? { data: { states: [{ name: "West Bengal" }] } } : { data: ["KOLKATA"] } });
    if (url.hostname === "api.postalpincode.in") return route.fulfill({ json: [{ Status: "Success", PostOffice: [{ State: "West Bengal", Pincode: "700001" }] }] });
    if (url.hostname.endsWith("example.invalid") || /\.(png|jpg|webp)(\?|$)/.test(url.pathname)) {
      return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    }
    if (!url.hostname.includes("bengolspices.com") && url.port !== "8000") return route.abort();
    const entry = { path: url.pathname, query: url.search, method: request.method(), body: request.postData(), authorization: request.headers().authorization || null, adminSession: request.headers()["x-admin-session"] || null, adminAuth: request.headers()["x-admin-auth"] || null };
    requests.push(entry);
    if (url.pathname === "/api/events/stream") return route.fulfill({ contentType: "text/event-stream", body: "event: ready\ndata: {}\n\n" });
    const override = overrides[url.pathname] || overrides[url.pathname.replace(/\/$/, "")];
    if (override) return override(route, entry);
    if (url.pathname.startsWith("/admin/order-workspace")) {
      const data = workspaceFixture(url, orders, stores, agents);
      return typeof data === "string" ? route.fulfill({ contentType: "text/csv", body: data }) : route.fulfill({ json: data });
    }
    const body = fixtureResponse(url.pathname, request.method());
    if (body === undefined) { unknown.push(entry); return route.fulfill({ status: 404, json: { success: false, message: "Missing synthetic fixture" } }); }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return route.fulfill({ status: 200, json: body });
  });
  return { requests, unknown };
}
