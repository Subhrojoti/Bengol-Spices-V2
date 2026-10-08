import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Check,
  ChevronDown,
  MapPin,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import useReveal from "../../../hooks/useReveal";

const CAREERS_EMAIL = "careers@bengolspices.com";

const HEADLINE_ROLES = [
  {
    icon: Users,
    title: "Agent",
    tagline: "Own a territory",
    desc: "Build and manage the retailer network in your area. You raise the orders, track the payments and keep the relationships warm.",
    points: [
      "Manage your own retailer network",
      "Place and track orders end to end",
      "Earn against daily targets and incentives",
    ],
    action: { label: "Apply as Agent", to: "/agent-onboarding" },
  },
  {
    icon: Truck,
    title: "Delivery Partner",
    tagline: "Keep it moving",
    desc: "Carry orders from the warehouse to the shop counter and bring returns back. Every job assigned to you is visible in your own app.",
    points: [
      "Pick up and deliver assigned orders",
      "Handle returns and exchanges",
      "Update status from your phone",
    ],
    action: { label: "Apply as Delivery Partner", to: "/delivery-partner-register" },
  },
];

const DEPARTMENTS = [
  "Distributer",
  "Accounts & Finance",
  "Sales & Marketing",
  "Operations",
  "Import / Export",
  "Warehouse & Logistics",
  "HR & Admin",
  "IT & Website",
  "Quality Control",
  "Production / Packaging",
  "Customer Support",
  "Purchase / Procurement",
];

/* Real screens from each app. The agent's sits behind, the delivery
   partner's overlaps it in front. */
const APP_WINDOWS = [
  {
    label: "Agent app · Marketing Hub",
    image: "/video-posters/Agent-Poster.jpg",
    position: "right-0 top-0 w-[88%]",
  },
  {
    label: "Delivery app · Delivery Hub",
    image: "/video-posters/Delivery-Poster.jpg",
    position: "bottom-0 left-0 w-[72%]",
  },
];

const PERKS = [
  "Work inside a system built for the job, not around it",
  "Clear targets, and incentives that follow them",
  "A growing network across India",
];

const Careers = () => {
  const [selectedRole, setSelectedRole] = useState(null);

  useReveal();

  /* Opens the visitor's own mail client rather than assuming Gmail in a
     browser tab, which the old link did. */
  const mailtoLink = selectedRole
    ? `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(
        `Application for ${selectedRole}`,
      )}&body=${encodeURIComponent(
        `Hi,\n\nI am interested in applying for the ${selectedRole} role at Bengol Spices.\n\nName:\nPhone:\nExperience:\n\nThank you.`,
      )}`
    : undefined;

  return (
    <div className="bg-[#faf7f2]">
      {/* ================= HERO ================= */}
      {/* A full first screen. With no photograph behind it, the depth comes
          from two warm glows at opposite corners, a fine grid and a vignette,
          so a screen of near-black does not read as empty. */}
      <section className="min-h-viewport relative flex items-center overflow-hidden bg-[#14100c] px-6 pb-20 pt-32 md:px-10 md:pb-28 md:pt-40 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #e0913a 0%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 h-[38rem] w-[38rem] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #b4541e 0%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 45%, transparent 30%, #14100c 95%)",
          }}
        />

        <span
          aria-hidden="true"
          className="scroll-cue absolute inset-x-0 bottom-8 mx-auto w-fit text-white/35">
          <ChevronDown size={22} />
        </span>

        {/* Text on the left, the two apps people join to use on the right,
            so a wide screen is not half empty */}
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p
              data-reveal
              className="reveal inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-[12.5px] font-medium text-amber-200">
              <Sparkles size={13} />
              We are hiring across India
            </p>

            <h1
              data-reveal
              className="reveal reveal-1 mt-6 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[54px] xl:text-[60px]">
              Join the people moving
              <span className="block text-amber-300">India's spice trade.</span>
            </h1>

            <p
              data-reveal
              className="reveal reveal-2 mt-6 max-w-xl text-[16px] leading-relaxed text-white/60">
              Whether you manage orders or deliver them, you sit at the heart of
              a supply chain connecting importers, agents, retailers and
              delivery partners.
            </p>

            <div
              data-reveal
              className="reveal reveal-3 mt-9 flex flex-wrap items-center gap-3">
              <Link
                to={HEADLINE_ROLES[0].action.to}
                className="group inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3.5 text-[14.5px] font-semibold text-[#14100c] transition hover:bg-amber-300">
                {HEADLINE_ROLES[0].action.label}
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <Link
                to={HEADLINE_ROLES[1].action.to}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[14.5px] font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/5">
                {HEADLINE_ROLES[1].action.label}
              </Link>
            </div>

            <ul
              data-reveal
              className="reveal reveal-4 mt-9 space-y-2.5">
              {PERKS.map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-2.5 text-[14px] text-white/55">
                  <Check size={14} className="shrink-0 text-amber-400" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          {/* The Agent and Delivery apps, as two overlapping windows */}
          <div
            data-reveal
            aria-hidden="true"
            className="reveal reveal-2 relative hidden lg:block">
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative aspect-[4/3]">
              {APP_WINDOWS.map((app) => (
                <figure
                  key={app.label}
                  className={`absolute overflow-hidden rounded-2xl border border-white/10 bg-[#211a14] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] ${app.position}`}>
                  <figcaption className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="ml-2 text-[11.5px] font-medium text-white/55">
                      {app.label}
                    </span>
                  </figcaption>
                  <img
                    src={app.image}
                    alt=""
                    width={1280}
                    height={720}
                    className="block aspect-video w-full object-cover object-top"
                  />
                </figure>
              ))}

              <div className="absolute bottom-10 right-0 rounded-2xl border border-white/10 bg-[#14100c]/85 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
                <p className="text-[12px] text-white/50">Once approved</p>
                <p className="mt-0.5 text-[14px] font-semibold text-white">
                  Your own app, from day one
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HEADLINE ROLES ================= */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28 lg:px-16">
        <div data-reveal className="reveal max-w-2xl">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
            Open to everyone
          </p>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
            Two ways to start today.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-[#6b6156]">
            Both roles apply online and get their own app the moment they are
            approved.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {HEADLINE_ROLES.map((role, i) => {
            const Icon = role.icon;

            return (
              <article
                key={role.title}
                data-reveal
                className={`reveal reveal-${i + 1} group flex flex-col rounded-3xl border border-[#e8dfd2] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_28px_70px_-32px_rgba(28,22,17,0.5)] md:p-9`}>
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1c1611] text-amber-300">
                    <Icon size={20} />
                  </span>

                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    {role.tagline}
                  </span>
                </div>

                <h3 className="mt-5 text-[26px] font-semibold text-[#1c1611]">
                  {role.title}
                </h3>

                <p className="mt-3 text-[14.5px] leading-relaxed text-[#6b6156]">
                  {role.desc}
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-[#f0e8dc] pt-6">
                  {role.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-[14px] text-[#5b5147]">
                      <Check size={14} className="mt-1 shrink-0 text-amber-600" />
                      {point}
                    </li>
                  ))}
                </ul>

                <Link
                  to={role.action.to}
                  className="group/btn mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1c1611] px-6 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-[#2a2119]">
                  {role.action.label}
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover/btn:translate-x-0.5"
                  />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* ================= DEPARTMENTS ================= */}
      <section className="border-y border-[#ece2d4] bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
          <div data-reveal className="reveal max-w-2xl">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Other opportunities
            </p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-[#1c1611] sm:text-[40px]">
              Join the team another way.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[#6b6156]">
              Pick the department you want to join and write to us. Your message
              opens ready to send.
            </p>
          </div>

          <div
            data-reveal
            className="reveal reveal-1 mt-10 rounded-3xl border border-[#e8dfd2] bg-[#faf7f2] p-6 md:p-9">
            <div className="flex items-center gap-2.5">
              <Briefcase size={16} className="text-amber-700" />
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8a7c6d]">
                Choose a department
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {DEPARTMENTS.map((role) => {
                const isSelected = selectedRole === role;

                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(isSelected ? null : role)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border px-3.5 py-3 text-left text-[13px] font-medium transition ${
                      isSelected
                        ? "border-[#1c1611] bg-[#1c1611] text-white"
                        : "border-[#e2d5c2] bg-white text-[#5b5147] hover:border-amber-400 hover:text-[#1c1611]"
                    }`}>
                    {role}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-[#e8dfd2] pt-6">
              {/* An anchor with no href is not focusable and reads as plain
                  text to a screen reader. Disabled state is a real button. */}
              {selectedRole ? (
                <a
                  href={mailtoLink}
                  className="group inline-flex items-center gap-2 rounded-full bg-amber-500 px-7 py-3.5 text-[14.5px] font-semibold text-[#14100c] transition hover:bg-amber-400">
                  Apply for {selectedRole}
                  <ArrowUpRight
                    size={16}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-full bg-[#e6dccd] px-7 py-3.5 text-[14.5px] font-semibold text-[#a3927c]">
                  Select a department first
                </button>
              )}

              <p className="text-[13px] text-[#8a7c6d]">
                Or write directly to{" "}
                <a
                  href={`mailto:${CAREERS_EMAIL}`}
                  className="font-medium text-[#1c1611] underline underline-offset-4">
                  {CAREERS_EMAIL}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CLOSER ================= */}
      <section className="relative overflow-hidden bg-[#faf7f2] py-20 md:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl"
        />

        <div data-reveal className="reveal relative mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e2d5c2] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#6b6156]">
            <MapPin size={13} className="text-amber-600" />
            Roles open across India
          </span>

          <h2 className="mt-6 text-[34px] font-semibold leading-[1.1] tracking-tight text-[#1c1611] sm:text-[44px]">
            Grow with Bengol Spices.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-[#6b6156]">
            Be part of a smarter, faster and more reliable supply chain network,
            with the tools to actually do the job well.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Careers;
