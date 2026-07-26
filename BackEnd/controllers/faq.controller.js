import FAQ from "../models/FAQ.js";

// GET FAQs
export const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true });

    res.json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs",
    });
  }
};
