import React, { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { getFaqs } from "../../../api/services";

/* ─── Skeleton Primitives ───────────────────────────────────────────── */

const shimmer =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent";

const SkeletonStyles = () => (
  <style>{`
    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }
    .skeleton-box {
      background-color: #e5e7eb;
      border-radius: 0.375rem;
    }
    /* Hide scrollbar for category tabs on mobile */
    .category-scroll::-webkit-scrollbar { display: none; }
    .category-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
);

const SkeletonBox = ({ className = "" }) => (
  <div className={`skeleton-box ${shimmer} ${className}`} />
);

/* ─── Left Sidebar Skeleton (desktop) ──────────────────────────────── */

const SidebarSkeleton = () => (
  <div className="w-1/4 hidden md:block">
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBox key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  </div>
);

/* ─── Mobile Category Tabs Skeleton ─────────────────────────────────── */

const MobileCategoryTabsSkeleton = () => (
  <div className="flex md:hidden gap-1 pb-2 mb-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <SkeletonBox
        key={i}
        className="h-9 rounded-full flex-1" // flex-1 = equally share full width
      />
    ))}
  </div>
);

/* ─── Right Content Skeleton ────────────────────────────────────────── */

const ContentSkeleton = () => (
  <div className="w-full md:w-3/4">
    {/* Mobile tabs skeleton */}
    <MobileCategoryTabsSkeleton />

    {/* Title */}
    <SkeletonBox className="h-7 w-40 mb-6 rounded-md hidden md:block" />

    {/* FAQ accordion rows */}
    <div className="bg-white rounded-xl shadow-sm divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="px-4 md:px-6 py-5 flex items-center justify-between">
          <SkeletonBox
            className={`h-4 rounded-md ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`}
          />
          <SkeletonBox className="h-4 w-4 rounded-sm ml-4 flex-shrink-0" />
        </div>
      ))}
    </div>

    {/* Contact card */}
    <div className="mt-6 md:mt-8 bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-3">
      <SkeletonBox className="h-5 w-36 rounded-md" />
      <SkeletonBox className="h-4 w-full md:w-72 rounded-md" />
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-4 w-4 rounded-full" />
          <SkeletonBox className="h-4 w-48 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-4 w-4 rounded-full" />
          <SkeletonBox className="h-4 w-36 rounded-md" />
        </div>
      </div>
    </div>
  </div>
);

/* ─── Main Component ────────────────────────────────────────────────── */

const HelpAndSupport = () => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState("GENERAL");
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const toggle = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  // Fetch FAQs
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await getFaqs();
        if (res?.success) {
          const data = res.data || [];

          setFaqs(data);

          const uniqueCategories = [
            ...new Set(data.map((item) => item.category)),
          ];

          setCategories(uniqueCategories);

          if (uniqueCategories.length) {
            setActiveCategory(uniqueCategories[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  // Filter FAQs by category
  const filteredFaqs = faqs.filter(
    (item) => item.category === activeCategory && item.isActive,
  );

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveIndex(null);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <SkeletonStyles />

      <div className="px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-6 md:py-10 flex gap-6 md:gap-10">
        {loading ? (
          <>
            <SidebarSkeleton />
            <ContentSkeleton />
          </>
        ) : (
          <>
            {/* LEFT SIDEBAR — visible on md+ only */}
            <div className="w-1/4 hidden md:block flex-shrink-0">
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-2 sticky top-6">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-4 py-3 rounded-lg cursor-pointer text-sm font-medium transition ${
                      activeCategory === cat
                        ? "bg-gray-100 text-black"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}>
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT CONTENT */}
            <div className="w-full md:w-3/4 min-w-0">
              {/* MOBILE CATEGORY TABS — horizontal scroll strip */}
              <div className="flex md:hidden gap-1 pb-3 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold border transition text-center ${
                      activeCategory === cat
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* PAGE TITLE */}
              <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">
                {activeCategory}
              </h2>

              {/* FAQ ACCORDION */}
              <div className="bg-white rounded-xl shadow-sm divide-y">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((item, index) => {
                    const isOpen = activeIndex === index;

                    return (
                      <div key={item._id}>
                        {/* QUESTION */}
                        <div
                          onClick={() => toggle(index)}
                          className={`flex justify-between items-center px-4 md:px-6 py-4 md:py-5 cursor-pointer gap-3 ${
                            isOpen ? "text-orange-600" : "text-gray-600"
                          }`}>
                          <span className="text-sm md:text-md font-bold leading-snug">
                            {item.question}
                          </span>

                          <span
                            className={`transition-transform flex-shrink-0 text-xs ${
                              isOpen ? "rotate-180" : ""
                            }`}>
                            ▼
                          </span>
                        </div>

                        {/* ANSWER */}
                        {isOpen && (
                          <div className="px-4 md:px-6 pb-4 md:pb-5 text-sm text-gray-600 leading-6 font-normal">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 md:px-6 py-5 text-sm text-gray-500">
                    No FAQs available.
                  </div>
                )}
              </div>

              {/* SUPPORT CONTACT */}
              <div className="mt-6 md:mt-8 bg-white rounded-xl shadow-sm p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  Need more help?
                </h3>
                <p className="text-sm text-gray-600">
                  If your query is not resolved, feel free to contact our
                  support team.
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-orange-600 flex-shrink-0" />
                    <a
                      href="mailto:support@bengolspices.com"
                      className="text-orange-600 font-medium hover:underline break-all">
                      support@bengolspices.com
                    </a>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2">
                    <Phone
                      size={16}
                      className="text-orange-600 flex-shrink-0"
                    />
                    <a
                      href="tel:+916289531457"
                      className="text-orange-600 font-medium hover:underline">
                      +91 6289531457
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HelpAndSupport;
