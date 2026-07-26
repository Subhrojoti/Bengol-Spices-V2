import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },

    orderId: { type: String, index: true, unique: true },

    seller: {
      name: String,
      address: String,
      gstin: String,
    },

    buyer: {
      name: String,
      phone: String,
      address: String,
    },

    items: [
      {
        name: String,
        quantity: Number,
        unitPrice: Number,
        gstRate: Number,
        gstAmount: Number,
        totalAmount: Number,
      },
    ],

    totalAmount: Number,
    totalGST: Number,
    paidAmount: Number,
    dueAmount: Number,

    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
    },

    payments: [
      {
        amount: Number,
        method: String,
        date: { type: Date, default: Date.now },
      },
    ],

    pdfUrl: String, // 🔥 Cloudinary URL

    invoiceDate: { type: Date, default: Date.now },
    dueDate: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Invoice", invoiceSchema);
