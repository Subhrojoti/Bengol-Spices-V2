/* =====================================================================
   CSV EXPORT

   Turns rows already on screen into a file Excel and Google Sheets open
   directly. Nothing is fetched: what is exported is what the page holds.

     downloadCsv("orders-2026-10-07.csv", [
       { header: "Order", value: (o) => o.orderId },
       { header: "Total", value: (o) => o.totalAmount },
     ], orders);
   ===================================================================== */

/* A cell that begins with = + - or @ is run as a formula by spreadsheet
   programs. Store and owner names come from forms people fill in, so a
   name like "=HYPERLINK(...)" would execute on the accountant's machine.
   A leading apostrophe makes the program treat the cell as text; it is not
   shown in the sheet. Real numbers are left as numbers so they still sum. */
const guardFormula = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

const cell = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();

  const text = guardFormula(String(value));

  // Quoted when it holds a comma, a quote or a line break; quotes doubled
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * @param {Array<{header: string, value: (row: any) => any}>} columns
 * @param {Array<any>} rows
 * @returns {string} the file's text
 */
export const toCsv = (columns, rows) =>
  [
    columns.map((c) => cell(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(",")),
  ].join("\r\n");

/** Saves the rows as a .csv file. Returns how many rows were written. */
export const downloadCsv = (filename, columns, rows) => {
  /* The first three bytes tell Excel the file is UTF-8. Without them the
     rupee sign and any Bengali or Hindi store name open as gibberish. */
  const blob = new Blob(["﻿", toCsv(columns, rows)], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return rows.length;
};

/** 2026-10-07, in the viewer's own timezone, for file names. */
export const fileDate = (date = new Date()) => {
  const two = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
};

/** A date as text a spreadsheet reads as a date: 07-Oct-2026 14:30 */
export const sheetDate = (value, withTime = false) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const two = (n) => String(n).padStart(2, "0");
  const day = `${two(date.getDate())}-${months[date.getMonth()]}-${date.getFullYear()}`;

  return withTime ? `${day} ${two(date.getHours())}:${two(date.getMinutes())}` : day;
};
