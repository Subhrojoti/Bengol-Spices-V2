import { useEffect } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Gauge,
  Leaf,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import Slide7 from "../../../assets/Slides/Slide7.png";
import Slide8 from "../../../assets/Slides/Slide8.png";
import logo from "../../../assets/logo/logoGold.png";
import logoBG from "../../../assets/logo/BS_Logo_BG.png";
import fssaiLogo from "../../../assets/logo/FSSAI_Logo.png";

const VALUES = [
  {
    icon: Leaf,
    title: "Authenticity",
    desc: "Every spice reflects true Indian origin, with taste, aroma and quality preserved at each step.",
  },
  {
    icon: ShieldCheck,
    title: "Reliability",
    desc: "From sourcing to delivery, a consistent and dependable supply chain our partners can plan around.",
  },
  {
    icon: Gauge,
    title: "Efficiency",
    desc: "One system connecting wholesalers, agents and retailers, cutting out the delays and the guesswork.",
  },
];

const CHAPTERS = [
  {
    kicker: "How it works",
    title: "Built for efficiency",
    body: "Agents place orders without friction, businesses receive stock on time, and delivery partners always know what is theirs to carry. The traditional back-and-forth of wholesale is simply gone.",
    points: [
      "Orders raised and tracked in one place",
      "Deliveries assigned the moment an order is confirmed",
      "Payments and dues recorded against every order",
    ],
    image: Slide7,
  },
  {
    kicker: "Where we reach",
    title: "Our network",
    body: "From sourcing premium spices to delivering them across cities, we connect every node in the ecosystem, keeping consistency, quality and trust intact from the grower to the shop counter.",
    points: [
      "Territories assigned to agents by pincode",
      "Pricing matched to each store's trade tier",
      "Nationwide delivery coverage",
    ],
    image: Slide8,
  },
];

const ADDRESS_LINES = [
  "BENGOL SPICES PRIVATE LIMITED",
  "23/23, Kalipur Kancha Road, Marich Jhapi",
  "Paschim Putiary, Kolkata 700082",
  "West Bengal, India",
];

const MAPS_LINK =
  "https://www.google.com/maps/place/23%2F23,+Kalipur+Kancha+Rd,+Marich+Jhapi,+Paschim+Putiary,+Kolkata,+West+Bengal+700082/@22.4776054,88.3324406,20.38z";

const AboutUs = () => {
  /* Same reveal mechanism the home page uses, so the public pages move
     alike and scrolling stays free of listeners. */
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
      {/* ================= HERO ================= */}
      {/* A full first screen, so the sourcing photograph reads as a picture
          rather than a strip. Content is centred in it and the rest of the
          page sits below the fold. */}
      <section className="min-h-viewport relative flex items-center overflow-hidden bg-[#14100c] px-6 pb-24 pt-32 md:px-10 md:pb-32 md:pt-40 lg:px-16">
        <img
          src={logoBG}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#14100c]/85 via-[#14100c]/75 to-[#14100c]" />

        {/* Nothing peeks above the fold on a full-screen hero, so the cue
            says there is more below. */}
        <span
          aria-hidden="true"
          className="scroll-cue absolute inset-x-0 bottom-8 mx-auto w-fit text-white/35">
          <ChevronDown size={22} />
        </span>

        <div className="relative mx-auto w-full max-w-4xl text-center">
          <img
            src={logo}
            alt="Bengol Spices"
            data-reveal
            className="reveal mx-auto h-28 object-contain sm:h-36 md:h-44"
          />

          <p
            data-reveal
            className="reveal reveal-1 mt-8 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-400">
            Our mission
          </p>

          <p
            data-reveal
            className="reveal reveal-2 mt-5 text-[24px] font-normal leading-[1.4] text-white/85 sm:text-[30px] md:text-[34px]">
            To bring authentic Indian spices closer to every kitchen by creating
            a seamless supply chain between wholesalers, agents and retailers.
          </p>

          <p
            data-reveal
            className="reveal reveal-3 mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-white/45">
            Quality and convenience should go hand in hand. We built the whole
            system on that idea.
          </p>
        </div>
      </section>

      {/* ================= VALUES ================= */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28 lg:px-16">
        <div data-reveal className="reveal max-w-2xl">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
            What we stand for
          </p>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
            Three things we will not trade away.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {VALUES.map((value, i) => {
            const Icon = value.icon;

            return (
              <article
                key={value.title}
                data-reveal
                className={`reveal reveal-${i + 1} group rounded-3xl border border-[#e8dfd2] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_24px_60px_-28px_rgba(28,22,17,0.45)]`}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1c1611] text-amber-300">
                  <Icon size={20} />
                </span>

                <h3 className="mt-5 text-[21px] font-semibold text-[#1c1611]">
                  {value.title}
                </h3>

                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#6b6156]">
                  {value.desc}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ================= CHAPTERS ================= */}
      <section className="border-y border-[#ece2d4] bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl space-y-20 px-6 md:space-y-28 md:px-10 lg:px-16">
          {CHAPTERS.map((chapter, index) => (
            <div
              key={chapter.title}
              data-reveal
              className={`reveal flex flex-col gap-8 md:flex-row md:items-center md:gap-16 ${
                index % 2 !== 0 ? "md:flex-row-reverse" : ""
              }`}>
              <div className="w-full md:w-1/2">
                <div className="overflow-hidden rounded-3xl">
                  <img
                    src={chapter.image}
                    alt=""
                    loading="lazy"
                    className="h-64 w-full object-cover transition-transform duration-[900ms] ease-out hover:scale-[1.05] md:h-[420px]"
                  />
                </div>
              </div>

              <div className="w-full md:w-1/2">
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                  {chapter.kicker}
                </p>

                <h3 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[34px]">
                  {chapter.title}
                </h3>

                <p className="mt-4 text-[15.5px] leading-relaxed text-[#6b6156]">
                  {chapter.body}
                </p>

                <ul className="mt-6 space-y-3 border-t border-[#f0e8dc] pt-6">
                  {chapter.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-[14.5px] text-[#5b5147]">
                      <Check size={15} className="mt-1 shrink-0 text-amber-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal className="reveal">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Get in touch
            </p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
              Head office
            </h2>

            <address className="mt-6 not-italic">
              {ADDRESS_LINES.map((line, i) => (
                <p
                  key={line}
                  className={`text-[15.5px] leading-8 ${
                    i === 0
                      ? "font-semibold text-[#1c1611]"
                      : "text-[#6b6156]"
                  }`}>
                  {line}
                </p>
              ))}
            </address>

            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-[#e8dfd2] bg-white p-4">
              <img
                src={fssaiLogo}
                alt=""
                className="h-14 w-auto shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-[#1c1611]">
                  <BadgeCheck size={15} className="text-amber-600" />
                  FSSAI Licensed
                </p>
                <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[#8a7c6d]">
                  12825019002131
                </p>
              </div>
            </div>

            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-[#1c1611] px-6 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-[#2a2119]">
              <MapPin size={16} />
              Get directions
              <ArrowUpRight
                size={15}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
          </div>

          <div data-reveal className="reveal reveal-1">
            <div className="overflow-hidden rounded-3xl border border-[#e8dfd2] bg-white p-2 shadow-[0_24px_60px_-32px_rgba(28,22,17,0.45)]">
              <iframe
                title="Bengol Spices head office location"
                src="https://www.google.com/maps?q=22.4776054,88.3324406&z=17&output=embed"
                className="h-[320px] w-full rounded-2xl border-0 md:h-[460px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <p className="mt-4 flex items-center gap-2 text-[13px] text-[#8a7c6d]">
              <Building2 size={14} />
              Visits by appointment. Reach us through Help &amp; Support first.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
