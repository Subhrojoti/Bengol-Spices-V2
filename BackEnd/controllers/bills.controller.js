import fs from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { setImmediate } from "node:timers/promises";
import ZipStream from "zip-stream";
import Invoice from "../models/Invoice.js";
import { billsPipeline, listBills, billDetail } from "../services/bills.service.js";
import { workspaceOptions } from "../services/orderWorkspace.service.js";
import { generateInvoicePDFBuffer } from "../utils/generateInvoicePdf.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";

const respond = work => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await work(req)); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load bills" }); }
};
export const getBills = respond(req => listBills(req.query));
export const getBill = respond(req => billDetail(req.params.invoiceId));
export const getBillOptions = respond(req => workspaceOptions(req.query));

const downloads = new Set();
// Build privately on disk, one PDF at a time. A rendering failure returns an
// error instead of presenting a partial archive as a successful download.
export const downloadBills = async (req, res) => {
  const actor = `${req.user.role}:${req.user.id || req.user._id || "admin"}`;
  if (downloads.has(actor) || downloads.size >= 2) return res.status(429).set("Retry-After", "30").json({ message: "An invoice download is already being prepared. Try again shortly." });
  downloads.add(actor);
  const abort = new AbortController();
  const disconnected = () => { if (!res.writableFinished) abort.abort(); };
  res.on("close", disconnected);
  let folder, cursor, zip, writing;
  try {
    const stages = billsPipeline(req.query);
    cursor = Invoice.aggregate([...stages, { $sort: { invoiceDate: -1, _id: -1 } }]).cursor({ batchSize: 10 });
    const first = await cursor.next();
    if (!first) return res.status(404).json({ message: "No issued invoices match these filters" });
    folder = await mkdtemp(path.join(os.tmpdir(), "bengol-bills-"));
    const file = path.join(folder, "invoices.zip");
    zip = new ZipStream({ zlib: { level: 1 } });
    writing = pipeline(zip, fs.createWriteStream(file, { mode: 0o600 }), { signal: abort.signal });
    // A stream error can occur while PDF rendering is still in progress.
    writing.catch(() => {});
    let row = first;
    while (row) {
      abort.signal.throwIfAborted();
      const pdf = await generateInvoicePDFBuffer(row, row.order);
      const name = invoiceFileName(row.invoiceNumber || row.orderId).replace(/[^a-zA-Z0-9._-]/g, "_");
      await Promise.race([new Promise((resolve, reject) => zip.entry(pdf, { name: `${name}-${row._id}.pdf` }, error => error ? reject(error) : resolve())), writing]);
      await setImmediate();
      row = await cursor.next();
    }
    zip.finish();
    await writing;
    abort.signal.throwIfAborted();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.attachment("bengol-invoices.zip");
    res.setHeader("Content-Length", (await stat(file)).size);
    await pipeline(fs.createReadStream(file), res, { signal: abort.signal });
  } catch (error) {
    if (!abort.signal.aborted && !res.destroyed) {
      if (res.headersSent) res.destroy();
      else res.status(error.status || 500).json({ message: error.status ? error.message : "Could not prepare invoices. Please try again." });
    }
  } finally {
    downloads.delete(actor);
    abort.abort(); zip?.destroy();
    await writing?.catch(() => {});
    await cursor?.close().catch(() => {});
    if (folder) await rm(folder, { recursive: true, force: true });
    res.off("close", disconnected);
  }
};
