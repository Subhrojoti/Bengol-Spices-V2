export const generateInvoiceNumber = async () => {
  return `INV-${Date.now()}`;
};
