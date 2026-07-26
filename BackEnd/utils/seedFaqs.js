import FAQ from "../models/FAQ.js";

export const seedFAQs = async () => {
  try {
    await FAQ.deleteMany();

    await FAQ.insertMany([
      /* =============================
         GENERAL
      ============================= */

      {
        question: "What does Bengol Spices do?",
        answer:
          "Bengol Spices is engaged in manufacturing, processing, packaging, and distribution of high-quality spices and food products across India.",
        category: "GENERAL",
      },
      {
        question: "Where is Bengol Spices located?",
        answer:
          "We are based in Kolkata, West Bengal, and operate across multiple regions through our distribution network.",
        category: "GENERAL",
      },

      /* =============================
         PRODUCTS
      ============================= */

      {
        question: "What products do you offer?",
        answer:
          "We offer a wide range of spices such as turmeric, cumin, cardamom, ginger, along with customized spice blends and packaged food products.",
        category: "GENERAL",
      },
      {
        question: "How do you ensure product quality?",
        answer:
          "We follow strict sourcing, processing, and packaging standards to ensure freshness, purity, and consistent quality in every product.",
        category: "GENERAL",
      },

      /* =============================
         ORDERS
      ============================= */

      {
        question: "How can orders be placed?",
        answer:
          "Orders can be placed through our authorized agents or via our digital platform.",
        category: "ORDER",
      },
      {
        question: "Who can place orders?",
        answer:
          "Orders are placed by registered stores through assigned agents.",
        category: "ORDER",
      },
      {
        question: "Do you support bulk orders?",
        answer:
          "Yes, we specialize in wholesale and bulk distribution for businesses.",
        category: "ORDER",
      },

      /* =============================
         PAYMENTS (USP 🔥)
      ============================= */

      {
        question: "Can I place an order without full payment?",
        answer:
          "Yes, you can place an order by paying a minimum amount and complete the remaining payment later.",
        category: "PAYMENT",
      },
      {
        question: "What is the minimum payment required?",
        answer: "Orders can be placed with a minimum payment starting from ₹1.",
        category: "PAYMENT",
      },
      {
        question: "What payment methods are supported?",
        answer:
          "We support Cash, Online payments (Razorpay), and Mixed payment modes.",
        category: "PAYMENT",
      },
      {
        question: "When should the remaining payment be completed?",
        answer:
          "The remaining amount must be paid within 7 days from the order date.",
        category: "PAYMENT",
      },

      /* =============================
         DELIVERY
      ============================= */

      {
        question: "How does delivery work?",
        answer:
          "Orders are processed and delivered through our logistics and delivery partner network.",
        category: "DELIVERY",
      },
      {
        question: "Can I track my order?",
        answer:
          "Yes, tracking updates are available once the order is shipped.",
        category: "DELIVERY",
      },

      /* =============================
         TRUST
      ============================= */

      {
        question: "Are online payments secure?",
        answer:
          "Yes, all online transactions are securely processed via trusted payment gateways like Razorpay.",
        category: "GENERAL",
      },

      /* =============================
         BUSINESS / PARTNERSHIP
      ============================= */

      {
        question: "Can I become a distributor or partner?",
        answer:
          "Yes, we are open to partnerships and distribution opportunities. Please contact us for collaboration.",
        category: "GENERAL",
      },
      {
        question: "Do you support exports?",
        answer:
          "Yes, we aim to expand in both domestic and international markets for spice distribution.",
        category: "GENERAL",
      },
    ]);
  } catch (error) {
    console.error("❌ FAQ SEED ERROR:", error);
  }
};
