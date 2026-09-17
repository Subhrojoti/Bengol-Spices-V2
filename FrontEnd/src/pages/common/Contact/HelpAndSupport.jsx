import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  LifeBuoy,
  Mail,
  MessageCircleQuestion,
  Phone,
  Search,
  SearchX,
} from "lucide-react";
import { getFaqs } from "../../../api/services";

const SUPPORT_EMAIL = "support@bengolspices.com";
const SUPPORT_PHONE_LABEL = "+91 6289531457";
const SUPPORT_PHONE_HREF = "tel:+916289531457";

/* ─── Skeletons ─────────────────────────────────────────────────────── */

const SkeletonBox = ({ className = "" }) => (
  <div className={`skeleton-box ${className}`} />
);

const SkeletonStyles = () => (
  <style>{`
    @keyframes faq-shimmer {
      100% { background-position: -200% 0; }
    }
    .skeleton-box {
      background: linear-gradient(90deg, #ece4d8 25%, #f6f0e6 37%, #ece4d8 63%);
      background-size: 200% 100%;
      animation: faq-shimmer 1.4s linear infinite;
      border-radius: 0.75rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-box { animation: none; }
    }
  `}</style>
);

const SidebarSkeleton = () => (
  <div className="hidden w-64 shrink-0 md:block">
    <div className="space-y-2.5 rounded-3xl border border-[#e8dfd2] bg-white p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBox key={i} className="h-11 w-full" />
      ))}
    </div>
  </div>
);

const ContentSkeleton = () => (
  <div className="w-full min-w-0">
    <div className="mb-6 flex gap-2 md:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonBox key={i} className="h-9 flex-1 rounded-full" />
      ))}
    </div>

    <SkeletonBox className="mb-6 hidden h-8 w-48 md:block" />

    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-[#e8dfd2] bg-white px-5 py-5">
          <SkeletonBox className={`h-4 ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
          <SkeletonBox className="ml-4 h-4 w-4 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

/* ─── Main ──────────────────────────────────────────────────────────── */

const HelpAndSupport = () => {
  const [openId, setOpenId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("GENERAL");
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const searchRef = useRef(null);

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

  /* Search looks across every category, because someone typing "refund"
     does not know which tab it was filed under. An empty box falls back to
     the selected category exactly as before. */
  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  const visibleFaqs = useMemo(() => {
    const active = faqs.filter((item) => item.isActive);

    if (searching) {
      return active.filter(
        (item) =>
          item.question?.toLowerCase().includes(trimmedQuery) ||
          item.answer?.toLowerCase().includes(trimmedQuery),
      );
    }

    return active.filter((item) => item.category === activeCategory);
  }, [faqs, activeCategory, searching, trimmedQuery]);

  const countFor = (cat) =>
    faqs.filter((item) => item.category === cat && item.isActive).length;

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setOpenId(null);
    setQuery("");
  };

  const toggle = (id) => setOpenId((current) => (current === id ? null : id));

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <SkeletonStyles />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-[#14100c] px-6 pb-16 pt-28 md:px-10 md:pb-24 md:pt-36 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-[24rem] w-[24rem] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, #e0913a 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-[12.5px] font-medium text-amber-200">
            <LifeBuoy size={13} />
            Help &amp; Support
          </p>

          <h1 className="mt-6 text-[36px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[46px]">
            How can we help?
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/55">
            Search the answers below, or reach our team directly. We reply to
            every message.
          </p>

          <div className="relative mx-auto mt-9 max-w-xl">
            <Search
              size={17}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#a3927c]"
            />

            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenId(null);
              }}
              placeholder="Search for an answer"
              aria-label="Search frequently asked questions"
              className="w-full rounded-full border border-white/10 bg-white py-4 pl-[3.25rem] pr-5 text-[15px] text-[#1c1611] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.8)] outline-none transition placeholder:text-[#a3927c] focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
            />
          </div>
        </div>
      </section>

      {/* ================= BODY ================= */}
      <section className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20 lg:px-16">
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          {loading ? (
            <>
              <SidebarSkeleton />
              <ContentSkeleton />
            </>
          ) : (
            <>
              {/* CATEGORY RAIL — desktop */}
              <aside className="hidden w-64 shrink-0 md:block">
                <div className="sticky top-24">
                  <p className="px-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#a3927c]">
                    Topics
                  </p>

                  <nav className="mt-4 space-y-1.5">
                    {categories.map((cat) => {
                      const isActive = !searching && activeCategory === cat;

                      return (
                        <button
                          key={cat}
                          onClick={() => handleCategoryChange(cat)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-[13.5px] font-medium transition ${
                            isActive
                              ? "bg-[#1c1611] text-white"
                              : "text-[#6b6156] hover:bg-white hover:text-[#1c1611]"
                          }`}>
                          <span className="truncate">{cat}</span>

                          <span
                            className={`shrink-0 text-[11.5px] tabular-nums ${
                              isActive ? "text-amber-300" : "text-[#b6a894]"
                            }`}>
                            {countFor(cat)}
                          </span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="mt-8 rounded-2xl border border-[#e8dfd2] bg-white p-5">
                    <p className="text-[17px] font-semibold text-[#1c1611]">
                      Still stuck?
                    </p>

                    <p className="mt-2 text-[13.5px] leading-relaxed text-[#6b6156]">
                      Talk to the support team directly.
                    </p>

                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="mt-4 flex items-center gap-2.5 text-[13.5px] font-medium text-[#1c1611] transition hover:text-amber-700">
                      <Mail size={15} className="shrink-0 text-amber-600" />
                      <span className="truncate">{SUPPORT_EMAIL}</span>
                    </a>

                    <a
                      href={SUPPORT_PHONE_HREF}
                      className="mt-2.5 flex items-center gap-2.5 text-[13.5px] font-medium text-[#1c1611] transition hover:text-amber-700">
                      <Phone size={15} className="shrink-0 text-amber-600" />
                      {SUPPORT_PHONE_LABEL}
                    </a>
                  </div>
                </div>
              </aside>

              {/* CONTENT */}
              <div className="w-full min-w-0">
                {/* CATEGORY CHIPS — mobile */}
                <div className="no-scrollbar -mx-6 mb-6 flex gap-2 overflow-x-auto px-6 pb-1 md:hidden">
                  {categories.map((cat) => {
                    const isActive = !searching && activeCategory === cat;

                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[12.5px] font-semibold transition ${
                          isActive
                            ? "border-[#1c1611] bg-[#1c1611] text-white"
                            : "border-[#e2d5c2] bg-white text-[#6b6156]"
                        }`}>
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-[26px] font-semibold tracking-tight text-[#1c1611] sm:text-[32px]">
                    {searching ? "Search results" : activeCategory}
                  </h2>

                  <p className="text-[13px] text-[#8a7c6d]">
                    {visibleFaqs.length}{" "}
                    {visibleFaqs.length === 1 ? "answer" : "answers"}
                  </p>
                </div>

                {/* ACCORDION */}
                <div className="mt-6 space-y-3">
                  {visibleFaqs.length > 0 ? (
                    visibleFaqs.map((item) => {
                      const isOpen = openId === item._id;

                      return (
                        <div
                          key={item._id}
                          className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
                            isOpen
                              ? "border-amber-300 shadow-[0_20px_50px_-32px_rgba(28,22,17,0.5)]"
                              : "border-[#e8dfd2] hover:border-[#d9c9b2]"
                          }`}>
                          <button
                            onClick={() => toggle(item._id)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6">
                            <span
                              className={`text-[15px] font-semibold leading-snug transition-colors ${
                                isOpen ? "text-amber-800" : "text-[#1c1611]"
                              }`}>
                              {item.question}
                            </span>

                            <span
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                                isOpen
                                  ? "rotate-180 bg-amber-500 text-[#14100c]"
                                  : "bg-[#f3ece1] text-[#8a7c6d]"
                              }`}>
                              <ChevronDown size={15} />
                            </span>
                          </button>

                          {isOpen && (
                            <div className="px-5 pb-6 md:px-6">
                              <div className="border-t border-[#f0e8dc] pt-4 text-[14.5px] leading-7 text-[#5b5147]">
                                {item.answer}
                              </div>

                              {searching && (
                                <p className="mt-4 text-[11.5px] uppercase tracking-[0.08em] text-[#b6a894]">
                                  {item.category}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#ddcfba] bg-white px-6 py-14 text-center">
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3ece1] text-[#a3927c]">
                        {searching ? (
                          <SearchX size={20} />
                        ) : (
                          <MessageCircleQuestion size={20} />
                        )}
                      </span>

                      <p className="mt-4 text-[19px] font-semibold text-[#1c1611]">
                        {searching
                          ? "No answers match your search"
                          : "No FAQs available."}
                      </p>

                      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[#6b6156]">
                        {searching
                          ? "Try a different word, or write to our support team and we will answer you directly."
                          : "Nothing has been published under this topic yet."}
                      </p>

                      {searching && (
                        <button
                          onClick={() => {
                            setQuery("");
                            searchRef.current?.focus();
                          }}
                          className="mt-6 rounded-full border border-[#e2d5c2] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[#1c1611] transition hover:border-amber-400">
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* CONTACT — mobile, where the rail is hidden */}
                <div className="mt-10 rounded-3xl bg-[#1c1611] p-7 md:hidden">
                  <h3 className="text-[22px] font-semibold text-white">
                    Need more help?
                  </h3>

                  <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
                    If your query is not resolved, contact our support team.
                  </p>

                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="mt-5 flex items-center gap-2.5 text-[14px] font-medium text-white">
                    <Mail size={15} className="shrink-0 text-amber-400" />
                    <span className="break-all">{SUPPORT_EMAIL}</span>
                  </a>

                  <a
                    href={SUPPORT_PHONE_HREF}
                    className="mt-3 flex items-center gap-2.5 text-[14px] font-medium text-white">
                    <Phone size={15} className="shrink-0 text-amber-400" />
                    {SUPPORT_PHONE_LABEL}
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ================= CLOSER ================= */}
      <section className="border-t border-[#ece2d4] bg-white py-16 md:py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-center md:px-10 lg:px-16">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[36px]">
              Prefer to talk it through?
            </h2>

            <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-[#6b6156]">
              Our support team handles orders, deliveries, returns and account
              access.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="group inline-flex items-center gap-2 rounded-full bg-[#1c1611] px-6 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-[#2a2119]">
              <Mail size={16} />
              Email support
              <ArrowUpRight
                size={15}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>

            <a
              href={SUPPORT_PHONE_HREF}
              className="inline-flex items-center gap-2 rounded-full border border-[#e2d5c2] bg-white px-6 py-3.5 text-[14.5px] font-semibold text-[#1c1611] transition hover:border-amber-400">
              <Phone size={16} className="text-amber-600" />
              {SUPPORT_PHONE_LABEL}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpAndSupport;
