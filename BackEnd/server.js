import "dotenv/config"; // ✅ THIS LINE
import express from "express";
import cors from "cors";
import connectDB from "./database/db.js";
import agentRoutes from "./routes/agent.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoute from "./routes/auth.routes.js";
import storeRoutes from "./routes/store.routes.js";
import orderRoutes from "./routes/order.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import deliveryRoutes from "./routes/deliveryPartner.routes.js";
import productRoutes from "./routes/product.routes.js";
import returnRoutes from "./routes/return.routes.js";
import targetRoutes from "./routes/target.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import incentiveRoutes from "./routes/incentive.routes.js";
// import { seedFAQs } from "./utils/seedFaqs.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

connectDB();

//await seedFAQs();

// console.log(process.env.CLOUDINARY_API_KEY);

// ✅ USE ROUTER, NOT CONTROLLER
app.use("/agent", agentRoutes);
app.use("/admin", adminRoutes);
app.use("/employee", employeeRoutes);
app.use("/auth", authRoute);
app.use("/agent/store", storeRoutes);
app.use("/agent/orders", orderRoutes);
app.use("/delivery-partner", deliveryRoutes);
app.use("/products", productRoutes);
app.use("/returns", returnRoutes);
app.use("/targets", targetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/incentives", incentiveRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
