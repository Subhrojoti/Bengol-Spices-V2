export function formatCurrency(amount: number | undefined | null): string {
  const value = amount ?? 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
  return `₹${formatted}`;
}
