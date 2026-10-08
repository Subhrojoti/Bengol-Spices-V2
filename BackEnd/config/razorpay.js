import Razorpay from "razorpay";

/* The Razorpay client is made the first time it is used, not when this file
   loads. Built without its keys it throws, and built at load time that
   stopped the whole API from starting: one missing setting took logins,
   orders and cash payments down along with online payments.

   Everything that imports `razorpayInstance` keeps using it exactly as
   before (razorpayInstance.orders.create(...), .qrCode.fetch(...), and so
   on). With the keys in place nothing changes. Without them, only the
   online-payment request that needed the client fails, with a message
   that says why. */
let instance = null;

const client = () => {
  if (instance) return instance;

  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!key_id || !key_secret) {
    const error = new Error(
      "Online payments are not configured on the server (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing).",
    );
    error.statusCode = 503;
    throw error;
  }

  instance = new Razorpay({ key_id, key_secret });
  return instance;
};

export const razorpayInstance = new Proxy(
  {},
  {
    get: (_target, property) => client()[property],
  },
);
