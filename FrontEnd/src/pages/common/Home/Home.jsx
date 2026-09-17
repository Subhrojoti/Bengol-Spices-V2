import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  Globe2,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

import coriander from "../../../assets/products/BS_Coriander_Powder.jpeg";
import cumin from "../../../assets/products/BS_Cumin_Powder.jpeg";
import garamMasala from "../../../assets/products/BS_Garam_Masala.jpeg";
import redChilli from "../../../assets/products/BS_Red_Chilli_Powder.jpeg";
import turmeric from "../../../assets/products/BS_Turmeric_Powder.jpeg";
import HeroBG from "../../../assets/logo/BS_Home.png";
import fssaiLogo from "../../../assets/logo/FSSAI_Logo.png";

const PRODUCTS = [
  { name: "Coriander Powder", local: "Dhaniya", image: coriander },
  { name: "Cumin Powder", local: "Jeera", image: cumin },
  { name: "Garam Masala", local: "Masala", image: garamMasala },
  { name: "Red Chilli Powder", local: "Lal Mirch", image: redChilli },
  { name: "Turmeric Powder", local: "Haldi", image: turmeric },
];

const PILLARS = [
  {
    icon: Globe2,
    title: "Import & Export",
    desc: "Global sourcing from trusted growers, with every consignment checked before it reaches a warehouse.",
    points: ["Vetted supplier network", "Quality checked on arrival"],
  },
  {
    icon: Boxes,
    title: "Store Management",
    desc: "Retailers, wholesalers and distributors onboarded and priced correctly, each on their own terms.",
    points: ["Tiered pricing per store type", "Territories assigned by pincode"],
  },
  {
    icon: Truck,
    title: "Order & Delivery",
    desc: "Agents raise the order, partners carry it, and every step is recorded from placed to delivered.",
    points: ["Live status at every hop", "Payments tracked to the rupee"],
  },
];

const CREDENTIALS = [
  "FSSAI certified",
  "Delivering across India",
  "Quality checked consignments",
  "Direct from growers",
  "Tiered trade pricing",
  "Same-day dispatch",
];

const ECOSYSTEM = [
  {
    title: "Admin App",
    desc: "The central management platform that provides administrators with complete visibility and control over the business ecosystem. Admins can manage employees, delivery partners and agents while overseeing orders, returns and day-to-day operations.",
    features: [
      "Manage employees, agents & delivery partners",
      "Track, assign & manage orders and returns",
      "Create notifications, targets & products",
      "Monitor operations and business activities",
    ],
    video: "/videos/Admin-Preview.mp4",
    poster: "/video-posters/Admin-Poster.jpg",
  },
  {
    title: "Agent App",
    desc: "The agent-focused application for managing retailer relationships and daily sales operations. Agents can create and manage stores, place orders and returns, track payments and monitor their performance through targets and leaderboards.",
    features: [
      "Create & manage retailer stores",
      "Create, track & manage orders and returns",
      "Track payments and transaction details",
      "Analyze targets, performance & leaderboards",
    ],
    video: "/videos/Agent-Preview.mp4",
    poster: "/video-posters/Agent-Poster.jpg",
  },
  {
    title: "Delivery App",
    desc: "The delivery operations platform built to help delivery partners efficiently manage assigned orders and returns. It provides the information required to understand delivery details, update statuses and complete delivery or return workflows.",
    features: [
      "Analyze assigned deliveries and returns",
      "Update order & return statuses",
      "Access detailed delivery information",
      "Manage delivery and return workflows efficiently",
    ],
    video: "/videos/Delivery-Preview.mp4",
    poster: "/video-posters/Delivery-Poster.jpg",
  },
  {
    title: "Employee App",
    desc: "A powerful operational platform that provides employees with access to the same core business capabilities available to administrators, while ensuring that access is controlled through role-based permissions configured by the admin.",
    features: [
      "Access operational features based on permissions",
      "Manage assigned orders, stores & workflows",
      "Work with products, returns and business operations",
      "Permission-based access to admin capabilities",
    ],
    video: "/videos/Employee-Preview.mp4",
    poster: "/video-posters/Employee-Poster.jpg",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const videoRefs = useRef([]);

  /* Videos load and play only near the viewport, and pause once they leave.
     Kept exactly as written — it is what stops four clips downloading on
     first paint. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (entry.isIntersecting) {
            // Load the video only when it is near the viewport
            if (!video.src) {
              video.src = video.dataset.src;
              video.load();
            }

            video.play().catch(() => {});
          } else {
            // Pause when the video is outside the viewport
            video.pause();
          }
        });
      },
      {
        rootMargin: "200px 0px",
        threshold: 0.15,
      },
    );

    videoRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => observer.disconnect();
  }, []);

  /* Sections lift into place as they arrive. Same technique, so scrolling
     stays free of listeners. */
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#faf7f2]">
      {/* The hero and the credentials strip share one column that fills the
          first screen. The hero takes whatever is left after the strip, so
          the strip lands exactly on the fold instead of leaving a gap under
          a fixed-height hero. */}
      <div className="min-h-viewport flex flex-col">
        {/* ================= HERO ================= */}
        <section className="relative flex flex-1 items-center overflow-hidden bg-[#14100c]">
          <img
            src={HeroBG}
            alt=""
            className="hero-drift absolute inset-0 h-full w-full object-cover object-center"
          />

          {/* Scrim: dark enough to read on, warm enough to keep the spices */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#14100c]/95 via-[#14100c]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14100c] via-transparent to-[#14100c]/40" />

          <div className="relative mx-auto w-full max-w-7xl px-6 py-24 md:px-10 lg:px-16">
            <div className="max-w-2xl">
              <p
                data-reveal
                className="reveal inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-[12.5px] font-medium tracking-wide text-amber-200 backdrop-blur-sm">
                <Sparkles size={13} />
                Sourced globally, delivered locally
              </p>

              <h1
                data-reveal
                className="reveal reveal-1 mt-6 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px] lg:text-[64px]">
                The spice trade,
                <span className="block text-amber-300">run on one system.</span>
              </h1>

              <p
                data-reveal
                className="reveal reveal-2 mt-6 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-[16.5px]">
                Bengol Spices Pvt. Ltd. connects importers, wholesalers, agents
                and retailers through a single digital ecosystem. From the grower
                to the shop counter, every order, payment and delivery is
                accounted for.
              </p>

              <div data-reveal className="reveal reveal-3 mt-9 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/about")}
                  className="group inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3.5 text-[14.5px] font-semibold text-[#14100c] transition hover:bg-amber-300">
                  Our journey
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>

                <button
                  onClick={() => navigate("/agent-onboarding")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[14.5px] font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/5">
                  Become an agent
                </button>
              </div>
            </div>

            {/* Figures sit on the hero, so the first screen says something real */}
            <div
              data-reveal
              className="reveal reveal-4 mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md sm:grid-cols-4">
              {[
                { value: "5", label: "Spice varieties" },
                { value: "3", label: "Trade tiers priced" },
                { value: "4", label: "Connected apps" },
                { value: "India", label: "Delivery coverage" },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#14100c]/70 px-5 py-5">
                  <p className="text-[26px] font-semibold leading-none text-amber-300">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= CREDENTIALS MARQUEE ================= */}
        <section className="shrink-0 overflow-hidden border-y border-[#e6dccd] bg-[#14100c] py-4">
          <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
            {[...CREDENTIALS, ...CREDENTIALS].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.08em] text-white/45">
                <Leaf size={13} className="text-amber-400/70" />
                {item}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* ================= WHAT WE DO ================= */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28 lg:px-16">
        <div data-reveal className="reveal max-w-2xl">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
            What we do
          </p>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
            Import. Distribute. Deliver. Scale.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-[#5b5147]">
            One supply chain, handled end to end, with the paperwork kept
            honest at every step.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                data-reveal
                className={`reveal reveal-${i + 1} group relative overflow-hidden rounded-3xl border border-[#e8dfd2] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_24px_60px_-28px_rgba(28,22,17,0.45)]`}>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-amber-100/70 blur-2xl transition-opacity duration-300 group-hover:opacity-100 md:opacity-0"
                />

                <div className="relative">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1c1611] text-amber-300">
                    <Icon size={20} />
                  </span>

                  <h3 className="mt-5 text-[21px] font-semibold text-[#1c1611]">
                    {pillar.title}
                  </h3>

                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#6b6156]">
                    {pillar.desc}
                  </p>

                  <ul className="mt-5 space-y-2 border-t border-[#f0e8dc] pt-5">
                    {pillar.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-[13.5px] text-[#5b5147]">
                        <Check size={14} className="mt-0.5 shrink-0 text-amber-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ================= PRODUCTS ================= */}
      <section className="border-y border-[#ece2d4] bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
          <div
            data-reveal
            className="reveal flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                The range
              </p>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
                Ground fresh, packed clean.
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#ece2d4] bg-[#faf7f2] px-4 py-3">
              <img src={fssaiLogo} alt="" className="h-9 w-auto object-contain" />
              <p className="text-[12.5px] leading-snug text-[#6b6156]">
                FSSAI certified
                <br />
                <span className="text-[#98897a]">Hygienically processed</span>
              </p>
            </div>
          </div>

          {/* Scroll-snaps on a phone, settles into a row on a desktop */}
          <div className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:pb-0">
            {PRODUCTS.map((item, i) => (
              <article
                key={item.name}
                data-reveal
                className={`reveal reveal-${(i % 4) + 1} group w-[70vw] shrink-0 snap-start sm:w-[42vw] md:w-auto`}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#f4ece0]">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
                  />

                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#14100c]/80 to-transparent" />

                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1c1611] backdrop-blur-sm">
                    {item.local}
                  </span>

                  <div className="absolute inset-x-4 bottom-4">
                    <p className="text-[16.5px] font-semibold leading-tight text-white">
                      {item.name}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DIGITAL ECOSYSTEM ================= */}
      <section className="bg-[#14100c] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
          <div data-reveal className="reveal mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-400">
              Our digital ecosystem
            </p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
              Four apps. One supply chain.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-white/60">
              A connected suite built to manage operations, employees, agents,
              orders, payments, deliveries and returns across the entire
              business.
            </p>
          </div>

          <div className="mt-16 space-y-20 md:mt-24 md:space-y-32">
            {ECOSYSTEM.map((item, index) => (
              <div
                key={item.title}
                data-reveal
                className={`reveal flex flex-col gap-8 md:flex-row md:items-center md:gap-16 ${
                  index % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}>
                {/* Title, on a phone only */}
                <div className="w-full md:hidden">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-[12px] font-bold text-[#14100c]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="h-px w-6 bg-amber-400/40" />
                    <h3 className="text-[22px] font-semibold text-white">
                      {item.title}
                    </h3>
                  </div>
                </div>

                {/* Video, framed like a device so a flat clip gains depth */}
                <div className="w-full md:w-[58%]">
                  <div className="group relative rounded-[22px] bg-gradient-to-br from-white/20 via-white/5 to-transparent p-[1.5px] transition-transform duration-500 hover:scale-[1.015]">
                    <div className="overflow-hidden rounded-[21px] bg-[#1c1611] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
                      <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
                        <span className="h-2 w-2 rounded-full bg-white/15" />
                        <span className="h-2 w-2 rounded-full bg-white/15" />
                        <span className="h-2 w-2 rounded-full bg-white/15" />
                        <span className="ml-2 text-[11px] tracking-wide text-white/25">
                          {item.title.replace(" App", "").toLowerCase()}.bengolspices
                        </span>
                      </div>

                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el;
                        }}
                        data-src={item.video}
                        poster={item.poster}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="none"
                        className="aspect-video w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Copy */}
                <div className="w-full md:w-[42%]">
                  <div className="mb-5 hidden items-center gap-4 md:flex">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-400 text-[13px] font-bold text-[#14100c]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="h-px w-8 bg-amber-400/40" />
                    <h3 className="text-[28px] font-semibold text-white sm:text-[32px]">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-[15px] leading-7 text-white/60">
                    {item.desc}
                  </p>

                  <div className="mt-6">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-400/80">
                      Key capabilities
                    </p>

                    <ul className="space-y-2.5">
                      {item.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-[14px] text-white/70">
                          <BadgeCheck
                            size={15}
                            className="mt-0.5 shrink-0 text-amber-400"
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden bg-[#faf7f2] py-20 md:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl"
        />

        <div
          data-reveal
          className="reveal relative mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e2d5c2] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#6b6156]">
            <MapPin size={13} className="text-amber-600" />
            Now delivering across India
          </span>

          <h2 className="mt-6 text-[34px] font-semibold leading-[1.1] tracking-tight text-[#1c1611] sm:text-[46px]">
            Powering the future of spice distribution.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-[#6b6156]">
            Join Bengol Spices in building a smarter, faster and more reliable
            supply chain. Whether you sell, deliver or stock, there is a place
            for you in it.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/careers")}
              className="group inline-flex items-center gap-2 rounded-full bg-[#1c1611] px-7 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-[#2a2119]">
              Get started
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>

            {/* There is no /contact route; help and support is where the
                enquiry actually lands. */}
            <button
              onClick={() => navigate("/help")}
              className="inline-flex items-center gap-2 rounded-full border border-[#ded0bb] bg-white px-7 py-3.5 text-[14.5px] font-semibold text-[#1c1611] transition hover:border-[#c9b699]">
              Talk to us
            </button>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-[12.5px] text-[#98897a]">
            <ShieldCheck size={13} />
            FSSAI certified · Quality checked at every consignment
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
