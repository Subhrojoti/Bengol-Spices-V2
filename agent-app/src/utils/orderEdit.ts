/** The backend edits one quantity per product, even when an older order has
 * multiple lines for that product. Keep their combined reserved quantity. */
export function initialEditQuantities(lines: { productId?: string; quantity: number }[]): Record<string, string> {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (line.productId) quantities.set(line.productId, (quantities.get(line.productId) || 0) + line.quantity);
  }
  return Object.fromEntries([...quantities].map(([id, quantity]) => [id, String(quantity)]));
}
