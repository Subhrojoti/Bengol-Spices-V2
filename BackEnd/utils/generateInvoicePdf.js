import PDFDocument from "pdfkit";
import axios from "axios";
import fs from "fs";
import { fileURLToPath } from "url";

/* ══════════════════════════════════════════════════════════════
   TAX INVOICE — a recreation of the company's Tally invoice

   Every position, font size and rule below was measured from the
   Tally original, so the two line up. Text is Helvetica, which has
   Arial's widths, narrowed to 93% the way Tally prints it.

   All y values passed to put() are text baselines, in points from
   the top of the page.
══════════════════════════════════════════════════════════════ */

const SELLER = {
  name: "BENGOL SPICES PVT. LTD.",
  address: [
    "23/23, Kalipur Kacha Road, Sodpur, Nagvilla,",
    "Haridevpur , Kolkata -700082.",
  ],
  gstin: "19AANCB7545D1ZF",
  stateName: "West Bengal",
  stateCode: "19",
  email: "support@bengolspices.com",
};

const LOGO_URL =
  "https://res.cloudinary.com/dn8rh6hng/image/upload/v1776851019/a_r4twsz.png";

/* Helvetica has no ₹, so the symbol comes from a one-glyph subset of
   Arimo Bold (SIL Open Font License, licence beside the file). */
const RUPEE_FONT = fileURLToPath(
  new URL("../assets/fonts/Arimo-Bold-Rupee.ttf", import.meta.url),
);

const DECLARATION = [
  "We declare that this invoice shows the actual price of",
  "the goods described and that all particulars are true",
  "and correct.",
];

const PAYMENT_MODES = {
  CASH: "Cash",
  ONLINE: "Online",
  MIXED: "Mixed",
  QR: "QR",
};

const F = {
  r: "Helvetica",
  b: "Helvetica-Bold",
  i: "Helvetica-Oblique",
  bi: "Helvetica-BoldOblique",
};

/* ─────────────────────────────────────────────
   GEOMETRY  (points, measured from the original)
───────────────────────────────────────────── */
const LINE = 13; // Tally's line pitch
const BOX_L = 36;
const BOX_R = 504;
const BOX_MID = 270; // party column | details grid
const HEADER_MIN_BOTTOM = 274;
const BODY_MIN_HEIGHT = 246; // items header top → Total row, on a short invoice
const PAGE_BOTTOM = 812; // lowest baseline for the last line on a page

const COL = {
  sl: 36,
  desc: 49,
  hsn: 244,
  qty: 297,
  rate: 350,
  per: 403,
  amount: 425,
  end: 504,
};
const COL_EDGES = Object.values(COL);

/* ─────────────────────────────────────────────
   GST STATE CODES
───────────────────────────────────────────── */
const STATES = {
  "JAMMU AND KASHMIR": ["01", "Jammu and Kashmir"],
  "HIMACHAL PRADESH": ["02", "Himachal Pradesh"],
  PUNJAB: ["03", "Punjab"],
  CHANDIGARH: ["04", "Chandigarh"],
  UTTARAKHAND: ["05", "Uttarakhand"],
  UTTARANCHAL: ["05", "Uttarakhand"],
  HARYANA: ["06", "Haryana"],
  DELHI: ["07", "Delhi"],
  "NEW DELHI": ["07", "Delhi"],
  "NCT OF DELHI": ["07", "Delhi"],
  RAJASTHAN: ["08", "Rajasthan"],
  "UTTAR PRADESH": ["09", "Uttar Pradesh"],
  BIHAR: ["10", "Bihar"],
  SIKKIM: ["11", "Sikkim"],
  "ARUNACHAL PRADESH": ["12", "Arunachal Pradesh"],
  NAGALAND: ["13", "Nagaland"],
  MANIPUR: ["14", "Manipur"],
  MIZORAM: ["15", "Mizoram"],
  TRIPURA: ["16", "Tripura"],
  MEGHALAYA: ["17", "Meghalaya"],
  ASSAM: ["18", "Assam"],
  "WEST BENGAL": ["19", "West Bengal"],
  JHARKHAND: ["20", "Jharkhand"],
  ODISHA: ["21", "Odisha"],
  ORISSA: ["21", "Odisha"],
  CHHATTISGARH: ["22", "Chhattisgarh"],
  "MADHYA PRADESH": ["23", "Madhya Pradesh"],
  GUJARAT: ["24", "Gujarat"],
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": [
    "26",
    "Dadra and Nagar Haveli and Daman and Diu",
  ],
  "DADRA AND NAGAR HAVELI": ["26", "Dadra and Nagar Haveli and Daman and Diu"],
  "DAMAN AND DIU": ["26", "Dadra and Nagar Haveli and Daman and Diu"],
  MAHARASHTRA: ["27", "Maharashtra"],
  KARNATAKA: ["29", "Karnataka"],
  GOA: ["30", "Goa"],
  LAKSHADWEEP: ["31", "Lakshadweep"],
  KERALA: ["32", "Kerala"],
  "TAMIL NADU": ["33", "Tamil Nadu"],
  PUDUCHERRY: ["34", "Puducherry"],
  PONDICHERRY: ["34", "Puducherry"],
  "ANDAMAN AND NICOBAR ISLANDS": ["35", "Andaman and Nicobar Islands"],
  "ANDAMAN AND NICOBAR": ["35", "Andaman and Nicobar Islands"],
  TELANGANA: ["36", "Telangana"],
  "ANDHRA PRADESH": ["37", "Andhra Pradesh"],
  LADAKH: ["38", "Ladakh"],
};

const resolveState = (raw) => {
  if (!raw) return null;

  const key = String(raw)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!key) return null;
  if (STATES[key]) return { code: STATES[key][0], name: STATES[key][1] };

  const name = key.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return { code: null, name };
};

/* ─────────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────────── */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const money = (n) =>
  round2(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Tally prints a negative adjustment as (-)0.01
const signedMoney = (n) => (n < 0 ? `(-)${money(-n)}` : money(n));

const count = (n) => (Number(n) || 0).toLocaleString("en-IN");

const percent = (n) => `${round2(n)}%`;

const sumOf = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

/* 5-Sep-26, in Indian time whatever timezone the server runs in */
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value;

  return `${part("day")}-${part("month")}-${part("year")}`;
};

const amountInWords = (amount) => {
  const totalPaise = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  // "INR Seventy One paise Only", never "INR Zero and Seventy One paise"
  const parts = [
    rupees ? numberToWords(rupees) : "",
    paise ? `${numberToWords(paise)} paise` : "",
  ].filter(Boolean);

  return `INR ${parts.join(" and ") || "Zero"} Only`;
};

/* ─────────────────────────────────────────────
   DRAWING HELPERS
───────────────────────────────────────────── */
const RULE = 0.5;

const hline = (doc, x1, x2, y, width = RULE) =>
  doc
    .save()
    .moveTo(x1, y)
    .lineTo(x2, y)
    .lineWidth(width)
    .strokeColor("#000000")
    .stroke()
    .restore();

const vline = (doc, x, y1, y2, width = RULE) =>
  doc
    .save()
    .moveTo(x, y1)
    .lineTo(x, y2)
    .lineWidth(width)
    .strokeColor("#000000")
    .stroke()
    .restore();

const textWidth = (doc, text, { font = F.r, size = 10, scale = 93 } = {}) =>
  doc.font(font).fontSize(size).widthOfString(text, {
    horizontalScaling: scale,
  });

/* Places one line of text with its baseline at y. Alignment is worked
   out here rather than by PDFKit, whose own alignment ignores
   horizontal scaling. */
const put = (
  doc,
  value,
  x,
  y,
  { font = F.r, size = 10, scale = 93, align = "left" } = {},
) => {
  const text = String(value ?? "");
  if (!text) return;

  const width = textWidth(doc, text, { font, size, scale });
  const left =
    align === "right" ? x - width : align === "center" ? x - width / 2 : x;

  doc.fillColor("#000000").text(text, left, y, {
    lineBreak: false,
    baseline: "alphabetic",
    horizontalScaling: scale,
  });
};

/* Largest scale, up to the normal 93%, at which the text fits */
const fitScale = (doc, text, maxWidth, { font = F.r, size = 10 } = {}) => {
  const natural = textWidth(doc, text, { font, size, scale: 93 });
  if (natural <= maxWidth) return 93;
  return Math.max(1, Math.floor((93 * maxWidth) / natural));
};

/* Tally never lets text spill out of its box. It narrows the letters
   first, and only wraps once they would get too narrow to read. */
const fitLines = (
  doc,
  value,
  maxWidth,
  { font = F.r, size = 10, minScale = 75 } = {},
) => {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];

  const single = fitScale(doc, text, maxWidth, { font, size });
  if (single >= minScale) return [{ text, scale: single }];

  const lines = [];
  let current = "";
  text.split(" ").forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(doc, next, { font, size }) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);

  return lines.map((line) => ({
    text: line,
    scale: fitScale(doc, line, maxWidth, { font, size }),
  }));
};

/* ─────────────────────────────────────────────
   DATA
   The invoice record holds the amounts. The buyer's state, city and
   payment mode live on the order it was raised for.
───────────────────────────────────────────── */
const buildInvoiceData = (invoice, order) => {
  const address = order?.deliveryAddress ?? {};
  const state = resolveState(address.state);

  const items = (invoice.items ?? []).map((item) => {
    const total = Number(item.totalAmount) || 0;
    const tax = Number(item.gstAmount) || 0;

    return {
      name: item.name ?? "",
      hsn: item.hsn ?? "",
      quantity: Number(item.quantity) || 0,
      rate: Number(item.unitPrice) || 0,
      taxable: round2(total - tax),
      tax,
      gstRate: Number(item.gstRate) || 0,
    };
  });

  /* A buyer in the seller's own state is an intra-state supply, taxed as
     CGST and SGST in equal halves. Any other state is IGST. When the
     state is unknown the supply is treated as local, as the previous
     invoice assumed West Bengal. */
  const intraState = !state?.code || state.code === SELLER.stateCode;

  // Tally summarises tax by HSN code and rate
  const groups = new Map();
  items.forEach((item) => {
    const key = `${item.hsn}|${item.gstRate}`;
    const group = groups.get(key) ?? {
      hsn: item.hsn,
      rate: item.gstRate,
      taxable: 0,
      tax: 0,
    };
    group.taxable += item.taxable;
    group.tax += item.tax;
    groups.set(key, group);
  });

  const taxRows = [...groups.values()].map((group) => {
    const tax = round2(group.tax);
    const central = round2(tax / 2);

    return {
      hsn: group.hsn,
      rate: group.rate,
      taxable: round2(group.taxable),
      tax,
      central,
      state: round2(tax - central),
    };
  });

  const taxable = round2(sumOf(taxRows, "taxable"));
  const tax = round2(sumOf(taxRows, "tax"));
  const central = round2(sumOf(taxRows, "central"));
  const stateTax = round2(sumOf(taxRows, "state"));
  const grandTotal =
    invoice.totalAmount != null
      ? round2(invoice.totalAmount)
      : round2(taxable + tax);
  const roundOff = round2(grandTotal - taxable - tax);

  const taxLines = [];
  if (tax) {
    if (intraState) taxLines.push(["CGST", central], ["SGST", stateTax]);
    else taxLines.push(["IGST", tax]);
  }
  if (roundOff) taxLines.push(["Round Off", roundOff]);

  return {
    invoiceNumber: invoice.invoiceNumber ?? "",
    invoiceDate: formatDate(invoice.invoiceDate ?? invoice.createdAt),
    orderId: invoice.orderId ?? "",
    orderDate: formatDate(order?.createdAt),
    paymentMode: PAYMENT_MODES[order?.paymentMode] ?? "",
    destination: address.city ?? "",
    party: {
      name: String(
        address.storeName ?? invoice.buyer?.name ?? "",
      ).toUpperCase(),
      lines: [
        address.street ?? invoice.buyer?.address,
        [address.city, address.pincode].filter(Boolean).join(" - "),
      ].filter(Boolean),
      gstin: invoice.buyer?.gstin ?? "",
      state,
    },
    items,
    totalQuantity: sumOf(items, "quantity"),
    intraState,
    taxRows,
    taxLines,
    taxable,
    tax,
    central,
    stateTax,
    grandTotal,
  };
};

/* ─────────────────────────────────────────────
   LAYOUT  (measured before anything is drawn, so
   pages can be planned)
───────────────────────────────────────────── */
const layoutHeader = (doc, data) => {
  const seller = [
    { text: SELLER.name, font: F.b },
    ...SELLER.address.map((text) => ({ text, font: F.r })),
    { text: `GSTIN/UIN: ${SELLER.gstin}`, font: F.r },
    {
      text: `State Name : ${SELLER.stateName}, Code : ${SELLER.stateCode}`,
      font: F.r,
    },
    { text: `E-Mail : ${SELLER.email}`, font: F.r },
  ].map((line, i) => ({
    ...line,
    y: 47 + LINE * i,
    scale: fitScale(doc, line.text, 135.5, { font: line.font }),
  }));

  const sellerBottom = seller[seller.length - 1].y + 12;

  /* Consignee and buyer are the same store, printed twice as Tally does */
  const partyBlock = (label, top) => {
    const rows = [];
    let y = top + 11;
    rows.push({ kind: "label", text: label, y });

    y += 15;
    fitLines(doc, data.party.name, 229, { font: F.b }).forEach((line) => {
      rows.push({ kind: "name", ...line, y });
      y += LINE;
    });

    data.party.lines.forEach((text) => {
      fitLines(doc, text, 229).forEach((line) => {
        rows.push({ kind: "line", ...line, y });
        y += LINE;
      });
    });

    const pairs = [];
    if (data.party.gstin) pairs.push(["GSTIN/UIN", data.party.gstin]);
    if (data.party.state) {
      pairs.push([
        "State Name",
        data.party.state.code
          ? `${data.party.state.name}, Code : ${data.party.state.code}`
          : data.party.state.name,
      ]);
    }
    pairs.forEach(([key, value]) => {
      const text = `: ${value}`;
      rows.push({
        kind: "pair",
        key,
        text,
        scale: fitScale(doc, text, 155),
        y,
      });
      y += LINE;
    });

    const lastBaseline = y - LINE;
    return { rows, lastBaseline, bottom: lastBaseline + 2 };
  };

  const consignee = partyBlock("Consignee (Ship to)", sellerBottom);
  const buyer = partyBlock("Buyer (Bill to)", consignee.bottom);

  return {
    seller,
    sellerBottom,
    consignee,
    buyer,
    bottom: Math.max(HEADER_MIN_BOTTOM, buyer.lastBaseline + 10),
  };
};

const layoutRows = (doc, items) =>
  items.map((item, i) => {
    const desc = fitLines(doc, item.name, 190, { font: F.b, minScale: 80 });
    return { index: i + 1, item, desc, lines: Math.max(1, desc.length) };
  });

/* ─────────────────────────────────────────────
   SECTIONS
───────────────────────────────────────────── */
const drawHeader = (doc, data, header, logo, pageNumber) => {
  const hb = header.bottom;

  put(doc, "Tax Invoice", 266.4, 31, { font: F.b, size: 12, align: "center" });
  if (pageNumber > 1) {
    put(doc, `Page ${pageNumber}`, 501, 31, {
      font: F.i,
      size: 9,
      align: "right",
    });
  }

  hline(doc, BOX_L, BOX_R, 33);
  vline(doc, BOX_L, 33, hb);
  vline(doc, BOX_R, 33, hb);
  vline(doc, BOX_MID, 34, hb - 1);

  /* ── Seller ── */
  if (logo) {
    try {
      doc.image(logo, 37, 34, {
        fit: [68, 45],
        align: "center",
        valign: "center",
      });
    } catch {
      // An unreadable logo should never stop the invoice
    }
  }

  header.seller.forEach((line) =>
    put(doc, line.text, 107, line.y, { font: line.font, scale: line.scale }),
  );
  hline(doc, 37, 268, header.sellerBottom);

  /* ── Consignee / Buyer ── */
  [header.consignee, header.buyer].forEach((block, i) => {
    block.rows.forEach((row) => {
      if (row.kind === "label") put(doc, row.text, 39, row.y, { size: 9 });
      if (row.kind === "name")
        put(doc, row.text, 39, row.y, { font: F.b, scale: row.scale });
      if (row.kind === "line")
        put(doc, row.text, 39, row.y, { scale: row.scale });
      if (row.kind === "pair") {
        put(doc, row.key, 39, row.y);
        put(doc, row.text, 113, row.y, { scale: row.scale });
      }
    });
    if (i === 0) hline(doc, 37, 268, block.bottom);
  });

  /* ── Details grid ── */
  const details = [
    [
      ["Invoice No.", data.invoiceNumber],
      ["Dated", data.invoiceDate],
    ],
    [
      ["Delivery Note", ""],
      ["Mode/Terms of Payment", data.paymentMode],
    ],
    [
      ["Reference No. & Date.", ""],
      ["Other References", ""],
    ],
    [
      ["Buyer’s Order No.", data.orderId],
      ["Dated", data.orderDate],
    ],
    [
      ["Dispatch Doc No.", ""],
      ["Delivery Note Date", ""],
    ],
    [
      ["Dispatched through", ""],
      ["Destination", data.destination],
    ],
    [
      ["Bill of Lading/LR-RR No.", ""],
      ["Motor Vehicle No.", ""],
    ],
  ];

  details.forEach((cells, i) => {
    const top = 34 + 25 * i;

    [
      [273, 271, 384],
      [388, 386, 500],
    ].forEach(([x, from, to], c) => {
      const [label, value] = cells[c];
      put(doc, label, x, top + 10, { size: 9 });
      if (value) {
        put(doc, value, x, top + 22, {
          font: F.b,
          scale: fitScale(doc, value, 109, { font: F.b }),
        });
      }
      hline(doc, from, to, top + 25);
    });
  });
  vline(doc, 386, 34, 209);

  put(doc, "Terms of Delivery", 273, 219, { size: 9 });

  return hb;
};

const drawItemsHeader = (doc, hb) => {
  hline(doc, BOX_L, BOX_R, hb);
  hline(doc, 37, 503, hb, 1); // Tally draws the table's top edge heavier
  hline(doc, 37, 503, hb + 30);

  put(doc, "Sl", 39, hb + 14, { scale: 73 });
  put(doc, "No.", 39, hb + 27, { scale: 43 });

  [
    ["Description of Goods", 100],
    ["HSN/SAC", 249],
    ["Quantity", 305],
    ["Rate", 366],
    ["per", 407],
    ["Amount", 448],
  ].forEach(([label, x]) => put(doc, label, x, hb + 13, { size: 9 }));
};

/* Draws item rows from the given first baseline; returns the baseline of
   the last line drawn */
const drawRows = (doc, rows, firstBaseline) => {
  let y = firstBaseline;

  rows.forEach(({ index, item, desc, lines }) => {
    // The Sl column is 13pt wide; longer numbers narrow and re-centre
    const number = String(index);
    put(doc, number, index < 10 ? 43.6 : 42.5, y + 1, {
      align: "center",
      scale: fitScale(doc, number, 9.5),
    });

    desc.forEach((line, i) =>
      put(doc, line.text, 51, y + LINE * i, { font: F.b, scale: line.scale }),
    );

    if (item.hsn) {
      put(doc, item.hsn, 247, y, {
        size: 9,
        scale: fitScale(doc, item.hsn, 47, { size: 9 }),
      });
    }

    const quantity = `${count(item.quantity)} pcs`;
    put(doc, quantity, 343, y, {
      font: F.b,
      align: "right",
      scale: fitScale(doc, quantity, 45, { font: F.b }),
    });

    const rate = money(item.rate);
    put(doc, rate, 399, y, {
      size: 9,
      align: "right",
      scale: fitScale(doc, rate, 45, { size: 9 }),
    });

    put(doc, "pcs", 408, y, { size: 9 });

    const amount = money(item.taxable);
    put(doc, amount, 495, y, {
      font: F.b,
      align: "right",
      scale: fitScale(doc, amount, 67, { font: F.b }),
    });

    y += LINE * lines;
  });

  return y - LINE;
};

/* Subtotal and the tax ledgers under the items */
const drawTaxLines = (doc, data, lastBaseline) => {
  if (!data.taxLines.length) return;

  hline(doc, 427, 501, lastBaseline + 9);
  put(doc, money(data.taxable), 495, lastBaseline + 21, { align: "right" });

  data.taxLines.forEach(([label, amount], i) => {
    const y = lastBaseline + 38 + LINE * i;
    put(doc, label, 240, y, { font: F.bi, align: "right" });
    put(doc, signedMoney(amount), 495, y + 1, { font: F.b, align: "right" });
  });
};

const taxLinesHeight = (data) =>
  data.taxLines.length ? 38 + LINE * (data.taxLines.length - 1) : 0;

const drawBodyFrame = (doc, hb, bodyBottom) => {
  COL_EDGES.forEach((x) => vline(doc, x, hb, bodyBottom));
  hline(doc, BOX_L, BOX_R, bodyBottom);
};

const drawRupee = (doc, x, y, rupeeFont) => {
  if (rupeeFont) {
    try {
      doc.font("Rupee").fontSize(12).fillColor("#000000").text("₹", x, y, {
        lineBreak: false,
        baseline: "alphabetic",
      });
      return;
    } catch {
      // Fall through to the plain-text symbol
    }
  }
  put(doc, "Rs.", x + 6.6, y, { font: F.b, size: 9, align: "right" });
};

const drawTotals = (doc, data, layout, bodyBottom, rupeeFont) => {
  const bb = bodyBottom;

  /* ── Total row ── */
  COL_EDGES.slice(1, -1).forEach((x) => vline(doc, x, bb + 1, bb + 16));
  vline(doc, BOX_L, bb, bb + 17);
  vline(doc, BOX_R, bb, bb + 17);
  hline(doc, BOX_L, BOX_R, bb + 17);

  put(doc, "Total", 240.6, bb + 11, { size: 9, align: "right" });
  if (data.items.length) {
    const quantity = `${count(data.totalQuantity)} pcs`;
    put(doc, quantity, 343, bb + 11, {
      font: F.b,
      align: "right",
      scale: fitScale(doc, quantity, 45, { font: F.b }),
    });
  }

  // ₹ and the figure share the Amount column: 494.7 back to 427
  const grand = money(data.grandTotal);
  const grandScale = fitScale(doc, grand, 58.6, { font: F.b, size: 12 });
  const grandWidth = textWidth(doc, grand, {
    font: F.b,
    size: 12,
    scale: grandScale,
  });
  put(doc, grand, 494.7, bb + 14, {
    font: F.b,
    size: 12,
    scale: grandScale,
    align: "right",
  });
  drawRupee(doc, 494.7 - grandWidth - 9.1, bb + 14, rupeeFont);

  /* ── Amount in words ── */
  const w = bb + 17;
  put(doc, "Amount Chargeable (in words)", 39, w + 10, { size: 9, scale: 81 });
  put(doc, "E. & O.E", 496.6, w + 10, { font: F.i, size: 9, align: "right" });
  layout.words.forEach((line, i) =>
    put(doc, line.text, 39, w + 25 + LINE * i, {
      font: F.b,
      scale: line.scale,
    }),
  );

  const wordsBottom = w + 30 + LINE * (layout.words.length - 1);
  vline(doc, BOX_L, w, wordsBottom);
  vline(doc, BOX_R, w, wordsBottom);
  hline(doc, BOX_L, BOX_R, wordsBottom);

  /* ── HSN / tax summary ── */
  const t = wordsBottom;
  const cols = data.intraState
    ? {
        hsn: 191,
        taxable: 251,
        groups: [
          ["CGST", 287, 347, "central"],
          ["SGST", 383, 443, "state"],
        ],
      }
    : { hsn: 287, taxable: 347, groups: [["IGST", 383, 443, "tax"]] };

  const tableBottom = t + 28 + 12 * data.taxRows.length + 14;

  put(doc, "HSN/SAC", (BOX_L + cols.hsn) / 2 - 4, t + 11, {
    size: 9,
    align: "center",
  });
  put(doc, "Taxable", (cols.hsn + cols.taxable) / 2 - 0.7, t + 11, {
    size: 9,
    align: "center",
  });
  put(doc, "Value", (cols.hsn + cols.taxable) / 2 - 0.7, t + 24, {
    size: 9,
    align: "center",
  });

  let groupStart = cols.taxable;
  cols.groups.forEach(([label, rateEnd, amountEnd]) => {
    put(doc, label, (groupStart + amountEnd) / 2 - 1.25, t + 11, {
      size: 9,
      align: "center",
    });
    hline(doc, groupStart, amountEnd, t + 14);
    put(doc, "Rate", (groupStart + rateEnd) / 2 - 1.15, t + 24, {
      size: 9,
      align: "center",
    });
    put(doc, "Amount", (rateEnd + amountEnd) / 2 - 1.6, t + 24, {
      size: 9,
      align: "center",
    });
    vline(doc, rateEnd, t + 13, tableBottom);
    vline(doc, amountEnd, t, tableBottom);
    groupStart = amountEnd;
  });

  put(doc, "Total", (groupStart + BOX_R) / 2 - 1.2, t + 11, {
    size: 9,
    align: "center",
  });
  put(doc, "Tax Amount", (groupStart + BOX_R) / 2 - 2.95, t + 24, {
    size: 9,
    align: "center",
  });

  hline(doc, 37, 503, t + 28);

  const summaryRow = (row, y, font, isTotal) => {
    if (!isTotal && row.hsn) put(doc, row.hsn, 39, y, { size: 9, font });
    put(doc, money(row.taxable), cols.taxable - 5, y, {
      size: 9,
      font,
      align: "right",
    });
    cols.groups.forEach(([, rateEnd, amountEnd, key]) => {
      if (!isTotal) {
        const rate = data.intraState ? row.rate / 2 : row.rate;
        put(doc, percent(rate), rateEnd - 3, y, { size: 9, align: "right" });
      }
      put(doc, money(row[key]), amountEnd - 5, y, {
        size: 9,
        font,
        align: "right",
      });
    });
    put(doc, money(row.tax), BOX_R - 6.4, y, { size: 9, font, align: "right" });
  };

  data.taxRows.forEach((row, i) => {
    const top = t + 28 + 12 * i;
    summaryRow(row, top + 10, F.r, false);
    hline(doc, 37, 503, top + 12);
  });

  const totalTop = t + 28 + 12 * data.taxRows.length;
  put(doc, "Total", cols.hsn - 3, totalTop + 11, {
    font: F.b,
    size: 9,
    align: "right",
  });
  summaryRow(
    {
      taxable: data.taxable,
      tax: data.tax,
      central: data.central,
      state: data.stateTax,
    },
    totalTop + 11,
    F.b,
    true,
  );

  [BOX_L, cols.hsn, cols.taxable, BOX_R].forEach((x) =>
    vline(doc, x, t, tableBottom),
  );
  hline(doc, BOX_L, BOX_R, tableBottom);

  /* ── Tax in words ── */
  const tw = tableBottom;
  put(doc, "Tax Amount (in words) :", 39, tw + 16, { size: 9, scale: 81 });
  layout.taxWords.forEach((line, i) =>
    put(doc, line.text, 133, tw + 16 + LINE * i, {
      font: F.b,
      scale: line.scale,
    }),
  );

  /* ── Declaration | Signatory ── */
  const s = tw + 19 + LINE * (layout.taxWords.length - 1);

  put(doc, "Declaration", 39, s + 8, { size: 7.2, scale: 100 });
  hline(doc, 39, 80, s + 10);
  DECLARATION.forEach((text, i) =>
    put(doc, text, 39, s + 19 + 10 * i, { size: 8.1, scale: 103 }),
  );

  hline(doc, BOX_MID, 503, s);
  vline(doc, BOX_MID, s, s + 42);
  put(doc, `for ${SELLER.name}`, 485.2, s + 10, {
    font: F.b,
    size: 9,
    scale: 81,
    align: "right",
  });
  put(doc, "Authorised Signatory", 491.7, s + 40, {
    size: 9,
    scale: 81,
    align: "right",
  });

  vline(doc, BOX_L, tw, s + 43);
  vline(doc, BOX_R, tw, s + 43);
  hline(doc, BOX_L, BOX_R, s + 43);

  put(doc, "This is a Computer Generated Invoice", 259.5, s + 59, {
    size: 9,
    align: "center",
  });
};

/* Height from the bottom of the items body to the footer baseline */
const totalsHeight = (data, layout) =>
  17 +
  (30 + LINE * (layout.words.length - 1)) +
  (28 + 12 * data.taxRows.length + 14) +
  (19 + LINE * (layout.taxWords.length - 1)) +
  43 +
  16;

/* ─────────────────────────────────────────────
   PAGES
   Items fill as many pages as they need. Every page repeats the
   header; the totals and tax summary close the last one.
───────────────────────────────────────────── */
const planPages = (data, header, rows, layout) => {
  const hb = header.bottom;
  const firstBaseline = hb + 46;
  const continuedBottom = PAGE_BOTTOM - 14;
  const below = totalsHeight(data, layout);

  const fitsOnPage = (lineCount) =>
    firstBaseline + LINE * (lineCount - 1) + 5 <= continuedBottom;

  const bodyBottomFor = (lineCount) => {
    const lastBaseline = firstBaseline + LINE * (Math.max(lineCount, 1) - 1);
    return Math.max(
      hb + BODY_MIN_HEIGHT,
      lastBaseline + taxLinesHeight(data) + 10,
    );
  };
  const fitsAsLast = (lineCount) =>
    bodyBottomFor(lineCount) + below <= PAGE_BOTTOM;

  const pages = [];
  let current = [];
  let lines = 0;

  rows.forEach((row) => {
    if (current.length && !fitsOnPage(lines + row.lines)) {
      pages.push(current);
      current = [];
      lines = 0;
    }
    current.push(row);
    lines += row.lines;
  });

  // The last page must also hold the totals; hand its final row over if not
  if (!fitsAsLast(lines) && current.length > 1) {
    const carried = current.pop();
    pages.push(current);
    current = [carried];
    lines = carried.lines;
  }
  pages.push(current);

  return { pages, firstBaseline, continuedBottom, bodyBottomFor };
};

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
let logoCache = null;

const loadLogo = async () => {
  if (logoCache) return logoCache;
  try {
    const res = await axios.get(LOGO_URL, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    logoCache = Buffer.from(res.data);
    return logoCache;
  } catch {
    return null;
  }
};

export const generateInvoicePDFBuffer = async (invoice, order = null) => {
  const logo = await loadLogo();

  return new Promise((resolve, reject) => {
    try {
      const data = buildInvoiceData(invoice, order);

      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        info: { Title: `Tax Invoice ${data.invoiceNumber}` },
      });
      const buffers = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      let rupeeFont = false;
      if (fs.existsSync(RUPEE_FONT)) {
        doc.registerFont("Rupee", RUPEE_FONT);
        rupeeFont = true;
      }

      const header = layoutHeader(doc, data);
      const rows = layoutRows(doc, data.items);
      const layout = {
        words: fitLines(doc, amountInWords(data.grandTotal), 462, {
          font: F.b,
        }),
        taxWords: fitLines(doc, amountInWords(data.tax), 368, { font: F.b }),
      };
      const plan = planPages(data, header, rows, layout);

      plan.pages.forEach((pageRows, i) => {
        if (i > 0) doc.addPage({ size: "A4", margin: 0 });
        const isLast = i === plan.pages.length - 1;

        const hb = drawHeader(doc, data, header, logo, i + 1);
        drawItemsHeader(doc, hb);

        const lastBaseline = pageRows.length
          ? drawRows(doc, pageRows, plan.firstBaseline)
          : plan.firstBaseline - LINE;

        if (!isLast) {
          drawBodyFrame(doc, hb, plan.continuedBottom);
          put(
            doc,
            `continued to page number ${i + 2}`,
            501,
            plan.continuedBottom + 12,
            {
              font: F.i,
              size: 9,
              align: "right",
            },
          );
          return;
        }

        drawTaxLines(doc, data, lastBaseline);
        const lineCount = pageRows.reduce((total, row) => total + row.lines, 0);
        const bodyBottom = plan.bodyBottomFor(lineCount);
        drawBodyFrame(doc, hb, bodyBottom);
        drawTotals(doc, data, layout, bodyBottom, rupeeFont);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/* ─────────────────────────────────────────────
   UTILITY — Indian number-to-words
───────────────────────────────────────────── */
function numberToWords(n) {
  if (!n || n === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const below1000 = (x) => {
    if (x < 20) return ones[x];
    if (x < 100)
      return tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
    return (
      ones[Math.floor(x / 100)] +
      " Hundred" +
      (x % 100 ? " " + below1000(x % 100) : "")
    );
  };

  let res = "";
  if (n >= 10000000) {
    res += below1000(Math.floor(n / 10000000)) + " Crore ";
    n %= 10000000;
  }
  if (n >= 100000) {
    res += below1000(Math.floor(n / 100000)) + " Lakh ";
    n %= 100000;
  }
  if (n >= 1000) {
    res += below1000(Math.floor(n / 1000)) + " Thousand ";
    n %= 1000;
  }
  if (n > 0) {
    res += below1000(n);
  }
  return res.trim();
}
