export const workspaceFixture = (url, orders, stores, agents) => {
  const params = url.searchParams;
  const label = order => ({ ...order, storeName: stores.find(s => s.consumerId === order.consumerId)?.storeName || order.deliveryAddress?.storeName, agentName: agents.find(a => a.agentId === order.agentId)?.name || order.agentId, storeImage: "" });
  if (url.pathname === "/admin/order-workspace/options") {
    const type = params.get("type"), q = (params.get("q") || "").toLowerCase();
    const options = (type === "agent" ? agents.map(a => ({ value: a.agentId, label: `${a.name} · ${a.agentId}` })) : stores.map(s => ({ value: s.consumerId, label: `${s.storeName} · ${s.consumerId}` }))).filter(o => !q || o.label.toLowerCase().includes(q)).slice(0, 30);
    return { success: true, options };
  }
  if (url.pathname.startsWith("/admin/order-workspace/") && !url.pathname.endsWith("/export")) { const order = orders.find(o => o.orderId === decodeURIComponent(url.pathname.split("/").at(-1))); return { success: true, order: order ? label(order) : null }; }
  const q = (params.get("q") || "").toLowerCase(), agent = params.get("agentId"), store = params.get("consumerId"), status = params.get("status") || "ALL", transit = ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
  const rows = orders.map(label).filter(o => (!q || [o.orderId, o.consumerId, o.storeName, o.agentId, o.agentName, o.deliveryAddress?.phone].join(" ").toLowerCase().includes(q)) && (!agent || o.agentId === agent) && (!store || o.consumerId === store) && (!params.get("from") || o.createdAt >= params.get("from") + "T00:00:00+05:30") && (!params.get("to") || new Date(o.createdAt) < new Date(new Date(params.get("to") + "T00:00:00+05:30").getTime() + 86400000)));
  const counts = { ALL: rows.length, PLACED: 0, CONFIRMED: 0, ASSIGNED: 0, SHIPPED: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  counts.IN_TRANSIT = transit.reduce((total, key) => total + counts[key], 0);
  const matching = rows.filter(o => status === "ALL" || (status === "IN_TRANSIT" ? transit.includes(o.status) : o.status === status));
  if (url.pathname.endsWith("/export")) return "Order ID,Store,Status\r\n" + matching.map(o => `${o.orderId},${o.storeName},${o.status}`).join("\r\n");
  const pageSize = Number(params.get("pageSize")) || 25, pages = Math.max(1, Math.ceil(matching.length / pageSize)), page = Math.min(Number(params.get("page")) || 1, pages);
  return { success: true, orders: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, counts, page, pageSize, pages };
};
