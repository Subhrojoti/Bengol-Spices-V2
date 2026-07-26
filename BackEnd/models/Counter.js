import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: {
    type: String, // allow values like "return-2026", "order-2026"
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("Counter", counterSchema);
