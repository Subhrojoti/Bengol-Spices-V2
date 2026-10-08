/* =====================================================================
   SEO: the single source of truth

   Every public page's title, description and structured data lives here.
   Two things read it:
     - RouteMeta, in the browser, keeps <head> right as people move around
     - scripts/prerender.mjs, at build time, writes each page out as real
       HTML so search engines and link previews never see an empty shell

   Plain JavaScript on purpose: no JSX and no asset imports, so Node can
   load it directly during the build.
   ===================================================================== */

export const SITE = {
  url: "https://www.bengolspices.com",
  name: "Bengol Spices",
  legalName: "Bengol Spices Pvt. Ltd.",
  tagline: "Indian spices for retailers, wholesalers and distributors",
  locale: "en_IN",
  themeColor: "#14100c",
  shareImage: "/og-image.jpg",
  logo: "/icon-512.png",
  email: "support@bengolspices.com",
  phone: "+916289531457",
  phoneDisplay: "+91 62895 31457",
  fssai: "12825019002131",
  address: {
    street: "23/23, Kalipur Kancha Road, Marich Jhapi, Paschim Putiary",
    city: "Kolkata",
    region: "West Bengal",
    postalCode: "700082",
    country: "IN",
  },
  geo: { latitude: 22.4776054, longitude: 88.3324406 },
};

/* The range shown on the home page. Each becomes part of the offer
   catalogue in the structured data. */
export const PRODUCTS = [
  { name: "Turmeric Powder", local: "Haldi" },
  { name: "Red Chilli Powder", local: "Lal Mirch" },
  { name: "Coriander Powder", local: "Dhaniya" },
  { name: "Cumin Powder", local: "Jeera" },
  { name: "Garam Masala", local: "Masala" },
];

/* Pages search engines should index, keyed by path.
   Titles stay under ~60 characters and descriptions under ~160, which is
   roughly where Google cuts them off in results. */
export const PAGES = {
  "/": {
    title: "Bengol Spices | Spice Supplier for Retailers & Wholesalers",
    description:
      "Bengol Spices supplies FSSAI-licensed turmeric, red chilli, coriander, cumin and garam masala powders to retailers, wholesalers and distributors across India.",
    priority: "1.0",
    changefreq: "weekly",
  },
  "/about": {
    title: "About Bengol Spices | FSSAI-Licensed Spice Company, Kolkata",
    description:
      "Bengol Spices Pvt. Ltd. is a Kolkata spice company linking growers, wholesalers, agents and retailers through one quality-checked supply chain.",
    breadcrumb: "About",
    priority: "0.8",
    changefreq: "monthly",
  },
  "/careers": {
    title: "Careers | Become a Bengol Spices Sales Agent or Delivery Partner",
    description:
      "Join Bengol Spices as a sales agent or delivery partner, or apply to our accounts, operations, warehouse and marketing teams. Roles open across India.",
    breadcrumb: "Careers",
    priority: "0.8",
    changefreq: "monthly",
  },
  "/help": {
    title: "Help & Support | Bengol Spices",
    description:
      "Answers on orders, payments, delivery and returns at Bengol Spices, with direct phone and email support for retailers, wholesalers and agents.",
    breadcrumb: "Help & Support",
    priority: "0.6",
    changefreq: "monthly",
  },
  "/terms": {
    title: "Terms & Conditions | Bengol Spices",
    description:
      "The terms that govern use of the Bengol Spices website and ordering platform, including orders, payments, deliveries and returns.",
    breadcrumb: "Terms & Conditions",
    priority: "0.3",
    changefreq: "yearly",
  },
  "/privacy": {
    title: "Privacy Policy | Bengol Spices",
    description:
      "How Bengol Spices collects, uses and protects the information of retailers, agents, delivery partners and visitors to its website.",
    breadcrumb: "Privacy Policy",
    priority: "0.3",
    changefreq: "yearly",
  },
  /* Application forms: public and worth finding, but they are forms rather
     than articles. The build gives each its own HTML file with the right
     title and share tags and an empty body (`prerender: false`); the form
     itself is drawn in the browser. */
  "/agent-onboarding": {
    title: "Apply as a Sales Agent | Bengol Spices",
    description:
      "Apply to become a Bengol Spices sales agent: manage your own retailer network, place orders from your phone and earn against daily targets.",
    breadcrumb: "Apply as Agent",
    priority: "0.7",
    changefreq: "monthly",
    prerender: false,
  },
  "/delivery-partner-register": {
    title: "Register as a Delivery Partner | Bengol Spices",
    description:
      "Register as a Bengol Spices delivery partner and carry orders from the warehouse to shops in your area, with every job tracked in your own app.",
    breadcrumb: "Register as Delivery Partner",
    priority: "0.7",
    changefreq: "monthly",
    prerender: false,
  },
};

/* /home is the same page as /. One address has to be the real one, or
   search engines split the ranking between the two. */
export const ALIASES = { "/home": "/" };

/* Everything else is the signed-in application. Each area gets a sensible
   tab title and is kept out of search results. */
const APP_TITLES = [
  ["/admin", "Admin Panel"],
  ["/employee", "Employee Panel"],
  ["/delivery", "Delivery Partner"],
  ["/marketing", "Agent"],
  ["/agent", "Agent"],
];

const trimSlash = (path) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

export const absoluteUrl = (path) => `${SITE.url}${path === "/" ? "/" : path}`;

/**
 * What <head> should say for a given path.
 * @returns {{title: string, description: string, canonical: string|null, index: boolean, path: string}}
 */
export const metaFor = (rawPath) => {
  const requested = trimSlash(rawPath || "/");
  const path = ALIASES[requested] ?? requested;
  const page = PAGES[path];

  if (page) {
    return {
      path,
      title: page.title,
      description: page.description,
      canonical: absoluteUrl(path),
      index: true,
    };
  }

  const area = APP_TITLES.find(([prefix]) => requested.startsWith(prefix));

  return {
    path: requested,
    title: area ? `${area[1]} | ${SITE.name}` : SITE.name,
    description: PAGES["/"].description,
    canonical: null,
    index: false,
  };
};

/* ─── Structured data (schema.org JSON-LD) ──────────────────────────── */

const organizationId = `${SITE.url}/#organization`;

/** The company itself. Printed on every page. */
export const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": ["Organization", "WholesaleStore"],
  "@id": organizationId,
  name: SITE.name,
  legalName: SITE.legalName,
  url: `${SITE.url}/`,
  logo: `${SITE.url}${SITE.logo}`,
  image: `${SITE.url}${SITE.shareImage}`,
  description: PAGES["/"].description,
  email: SITE.email,
  telephone: SITE.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE.address.street,
    addressLocality: SITE.address.city,
    addressRegion: SITE.address.region,
    postalCode: SITE.address.postalCode,
    addressCountry: SITE.address.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: SITE.geo.latitude,
    longitude: SITE.geo.longitude,
  },
  areaServed: { "@type": "Country", name: "India" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    telephone: SITE.phone,
    email: SITE.email,
    areaServed: "IN",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Ground spices",
    itemListElement: PRODUCTS.map((product) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Product",
        name: `${SITE.name} ${product.name}`,
        alternateName: product.local,
        category: "Spices",
        brand: { "@type": "Brand", name: SITE.name },
      },
    })),
  },
});

export const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: `${SITE.url}/`,
  name: SITE.name,
  inLanguage: "en-IN",
  publisher: { "@id": organizationId },
});

export const breadcrumbSchema = (path) => {
  const page = PAGES[path];
  if (!page?.breadcrumb) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE.url}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: page.breadcrumb,
        item: absoluteUrl(path),
      },
    ],
  };
};

/** Questions and answers shown on the help page. */
export const faqSchema = (faqs) => {
  const visible = (faqs || []).filter(
    (faq) => faq?.question && faq?.answer && faq.isActive !== false,
  );
  if (!visible.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: visible.map((faq) => ({
      "@type": "Question",
      name: String(faq.question),
      acceptedAnswer: { "@type": "Answer", text: String(faq.answer) },
    })),
  };
};
