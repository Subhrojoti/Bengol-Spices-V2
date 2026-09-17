import { Link, useNavigate } from "react-router-dom";
import { MapPin, ShieldCheck } from "lucide-react";
import logo from "../../assets/logo/Logo_Final.png";
import fssaiLogo from "../../assets/logo/FSSAI_Logo.png";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/careers", label: "Careers" },
    ],
  },
  {
    heading: "Support",
    links: [{ to: "/help", label: "Help & Support" }],
  },
  {
    heading: "Legal",
    links: [
      { to: "/terms", label: "Terms & Conditions" },
      { to: "/privacy", label: "Privacy Policy" },
    ],
  },
];

const Footer = () => {
  const navigate = useNavigate();

  /* 🔥 The old footer hardcoded "© 2025", so it was already a year out of
     date on the live site. */
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#14100c] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-12 lg:px-16">
        {/* Two columns on phones rather than one long stack */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr] lg:gap-8">
          {/* BRAND */}
          <div className="col-span-2 lg:col-span-1">
            <button
              onClick={() => navigate("/home")}
              className="flex items-center gap-2.5"
              aria-label="Bengol Spices, home">
              <img
                src={logo}
                alt=""
                className="h-10 w-10 rounded-lg bg-white/90 object-contain p-1"
              />
              <span className="text-left">
                <span className="block text-[15px] font-semibold leading-none">
                  Bengol Spices
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-white/40">
                  Pvt. Ltd.
                </span>
              </span>
            </button>

            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-white/50">
              Connecting importers, wholesalers, agents and retailers through a
              single digital supply chain.
            </p>

            <div className="mt-5 inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
              {/* The mark is dark blue and saffron, so it sits on white the way
                  certification logos are printed on packs */}
              <span className="grid h-9 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-white">
                <img
                  src={fssaiLogo}
                  alt="FSSAI"
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="text-[12px] leading-snug font-medium text-white/85">
                FSSAI certified
                <br />
                <span className="font-normal text-white/50">
                  Hygienically processed
                </span>
              </span>
            </div>
          </div>

          {/* LINK COLUMNS */}
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-400/80">
                {column.heading}
              </h2>

              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-white/55 underline-offset-4 transition hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* AVAILABILITY */}
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-400/80">
              Availability
            </h2>

            {/* Copy kept as written — nationwide coverage */}
            <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-white/55">
              <MapPin size={13} className="shrink-0 text-amber-400/70" />
              Nationwide across India.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-[12px] text-white/35 md:flex-row md:px-10 lg:px-16">
          <p>© {year} Bengol Spices Pvt. Ltd. All rights reserved.</p>

          <p className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-amber-400/50" />
            Quality checked at every consignment
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
