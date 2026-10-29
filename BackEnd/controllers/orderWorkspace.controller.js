import { listWorkspaceOrders, workspaceOrder, workspaceOptions, exportWorkspaceOrders } from "../services/orderWorkspace.service.js";

const handle = (work) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) {
    if (!error.status) console.error("ORDER WORKSPACE ERROR:", error.message);
    if (res.headersSent) return res.destroy();
    res.removeHeader("Content-Disposition"); res.type("application/json");
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load orders. Please retry." });
  }
};
export const getWorkspaceOrders = handle(async (req, res) => res.json(await listWorkspaceOrders(req.query)));
export const getWorkspaceOrder = handle(async (req, res) => res.json(await workspaceOrder(req.params.orderId)));
export const getWorkspaceOptions = handle(async (req, res) => res.json(await workspaceOptions(req.query)));
const write = (res, chunk) => new Promise((resolve, reject) => {
  if (res.destroyed) return resolve();
  const clean = () => { res.off("drain", done); res.off("close", done); res.off("error", fail); };
  const done = () => { clean(); resolve(); }, fail = (error) => { clean(); reject(error); };
  res.once("drain", done); res.once("close", done); res.once("error", fail);
  if (res.write(chunk)) done();
});
export const exportWorkspace = handle(async (req, res) => {
  // Validation happens before the first byte is written, preserving JSON errors.
  res.type("text/csv; charset=utf-8"); res.attachment("bengol-filtered-orders.csv");
  await exportWorkspaceOrders(req.query, chunk => write(res, chunk), () => res.destroyed);
  res.end();
});
