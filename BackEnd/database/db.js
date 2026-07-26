import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_URI}/bengol-spices`);
    console.log("MongoDB successfully connected");
  } catch (e) {
    console.log("Error", e);
  }
};

export default connectDB;
