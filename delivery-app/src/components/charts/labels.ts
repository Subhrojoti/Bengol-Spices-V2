const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Normalises whatever the API sends for a month ("January", "Jan", "2025-01",
 * "1") into a 3-letter label, so twelve labels fit on a phone-width chart.
 */
export function shortMonthLabel(raw: string): string {
  const value = String(raw ?? "").trim();

  const iso = value.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return MONTHS[Number(iso[2]) - 1] ?? value;

  if (/^\d{1,2}$/.test(value)) return MONTHS[Number(value) - 1] ?? value;

  const word = value.match(/^[A-Za-z]+/);
  if (word) {
    const abbr = word[0].slice(0, 3);
    return abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
  }

  return value;
}
