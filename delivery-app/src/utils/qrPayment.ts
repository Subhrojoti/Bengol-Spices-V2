export interface DeliveryQr { qrCodeId: string; imageUrl: string; amount: number; closeBy?: number }
export const qrAmount = (text: string, due: number): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 1 && amount <= due + 0.005 ? amount : null;
};
export const savedQr = (value: string): DeliveryQr => {
  const qr = JSON.parse(value) as DeliveryQr;
  if (!/^qr_[A-Za-z0-9]{6,60}$/.test(qr.qrCodeId) || !Number.isFinite(qr.amount) || qr.amount < 1 || typeof qr.imageUrl !== "string" || !qr.imageUrl.startsWith("https://")) throw new Error("Saved QR recovery needs office review. Do not collect again until resolved.");
  return qr;
};
