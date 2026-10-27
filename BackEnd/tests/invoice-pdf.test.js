import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateInvoicePDFBuffer } from "../utils/generateInvoicePdf.js";

const output = new URL("../../tmp/pdfs/", import.meta.url);
const standardFontDataUrl = fileURLToPath(new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)).replace(/\\/g, "/");
const sample = (count, state) => ({
  invoiceNumber: `TEST-${count}`, orderId: `ORDER-${count}`, invoiceDate: "2026-10-25T08:00:00Z",
  totalAmount: count * 105, buyer: { name: "Sample Store", address: "Sample Road", gstin: "TEST-GST" },
  items: Array.from({ length: count }, (_, i) => ({ name: `Sample Spice ${i + 1}`, hsn: "0910", quantity: 1, unitPrice: 100, totalAmount: 105, gstAmount: 5, gstRate: 5 })),
  state,
});

for (const [count, state] of [[2, "WEST BENGAL"], [65, "BIHAR"]]) {
  test(`invoice PDF: ${count} rows, bundled logo on every page, heading, tax and amounts retained`, async () => {
    const invoice = sample(count, state);
    const before = structuredClone(invoice);
    const order = { createdAt: invoice.invoiceDate, paymentMode: "CASH", deliveryAddress: { storeName: "Sample Store", street: "Sample Road", city: "Kolkata", pincode: "700001", state } };
    // Root working directory differs from backend: logo resolution must still work.
    const buffer = await generateInvoicePDFBuffer(invoice, order);
    assert.deepEqual(invoice, before);
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(new URL(`invoice-${count}.pdf`, output), buffer);
    const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl });
    const pdf = await loadingTask.promise;
    assert(count === 2 ? pdf.numPages === 1 : pdf.numPages > 1);
    let allText = "";
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((i) => i.str).join(" "); allText += text;
      assert.match(text, /Ordered Confirm Invoice/); assert.match(text, /Tax Invoice/);
      assert.match(text, /BENGOL SPICES/); assert.match(text, /19AANCB7545D1ZF/);
      const operations = await page.getOperatorList();
      assert(operations.fnArray.includes(OPS.paintImageXObject), `logo image on page ${n}`);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      await fs.writeFile(new URL(`invoice-${count}-page-${n}.png`, output), canvas.toBuffer("image/png"));
    }
    assert.match(allText, new RegExp((count * 105).toLocaleString("en-IN") + "\\.00"));
    assert.match(allText, state === "WEST BENGAL" ? /CGST/ : /IGST/);
    if (state === "WEST BENGAL") assert.match(allText, /SGST/);
    await loadingTask.destroy();
  });
}

test("invoice PDF retains packet units, precise net rates and the reported four-line totals", async () => {
  const gross = [36, 75, 35, 36], tax = [1.71, 3.57, 1.67, 1.71];
  const invoice = { invoiceNumber: "SAMPLE-182", orderId: "SAMPLE-ORDER", invoiceDate: "2026-10-24", totalAmount: 182, paidAmount: 1, dueAmount: 181,
    items: gross.map((totalAmount, i) => ({ name: `Sample Spice ${i + 1}`, quantity: 10, unitPrice: Math.round((totalAmount - tax[i]) * 100) / 1000, totalAmount, gstAmount: tax[i], gstRate: 5 })), buyer: { name: "Sample Store" } };
  const order = { createdAt: invoice.invoiceDate, paymentMode: "CASH", deliveryAddress: { storeName: "Sample Store", street: "Sample Road", city: "Kolkata", pincode: "743503", state: "WEST BENGAL" }, products: invoice.items.map((item) => ({ name: item.name, quantity: item.quantity, uom: "packet" })) };
  const before = structuredClone({ invoice, order });
  const buffer = await generateInvoicePDFBuffer(invoice, order);
  assert.deepEqual({ invoice, order }, before);
  await fs.mkdir(output, { recursive: true }); await fs.writeFile(new URL("invoice-packets.pdf", output), buffer);
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl }), pdf = await loadingTask.promise;
  assert.equal(pdf.numPages, 1);
  const page = await pdf.getPage(1), text = (await page.getTextContent()).items.map((item) => item.str).join(" ");
  for (const value of ["10 packets", "40 packets", "3.429", "7.143", "182.00", "173.34", "4.33"]) assert(text.includes(value), value);
  assert(!/\bpcs\b/.test(text));
  const viewport = page.getViewport({ scale: 1.6 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  await fs.writeFile(new URL("invoice-packets-page-1.png", output), canvas.toBuffer("image/png"));
  await loadingTask.destroy();
});
