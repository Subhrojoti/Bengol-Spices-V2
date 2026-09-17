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
import { frontendBaseUrl, frontendOrigins } from "./utils/frontendUrl.js";
// import { seedFAQs } from "./utils/seedFaqs.js";

const app = express();

// Don't advertise the framework, and add the basic protective headers
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* 🔒 Keys beginning with "$" are MongoDB query operators. Left in a request
   body, {"agentId": {"$ne": null}} stops being a value and becomes a
   condition that matches any record. No real request ever sends one, so
   they are simply dropped before any route sees the body. */
const stripQueryOperators = (value) => {
  if (Array.isArray(value)) {
    value.forEach(stripQueryOperators);
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$")) delete value[key];
      else stripQueryOperators(value[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body) stripQueryOperators(req.body);
  next();
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  JWT_SECRET is missing or shorter than 32 characters. Login tokens can be forged with a weak secret — set a long random one in .env.",
  );
}

const allowedOrigins = frontendOrigins();

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }),
);

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

// Unknown address: JSON like every other response, not an HTML page
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

/* Anything a route did not handle itself — a malformed JSON body, an
   oversized or rejected upload, an unexpected crash. Express's default
   answers with an HTML page that can include the stack trace. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request body" });
  }

  // Multer (file too large, unexpected field) and Cloudinary (file type)
  if (err.name === "MulterError" || err.http_code === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: err.message });
  }

  console.error("UNHANDLED ERROR:", err);
  return res
    .status(500)
    .json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Check this line in the server logs after deploying
  console.log(`Email links (password reset) open: ${frontendBaseUrl()}`);
});
