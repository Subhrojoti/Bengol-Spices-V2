import React, { useEffect, useRef } from "react";
import { Typography } from "@mui/material";
import coriander from "../../../assets/products/BS_Coriander_Powder.jpeg";
import cumin from "../../../assets/products/BS_Cumin_Powder.jpeg";
import garamMasala from "../../../assets/products/BS_Garam_Masala.jpeg";
import redChilli from "../../../assets/products/BS_Red_Chilli_Powder.jpeg";
import turmeric from "../../../assets/products/BS_Turmeric_Powder.jpeg";
import { useNavigate } from "react-router-dom";
import HeroBG from "../../../assets/logo/BS_Home.png";

const Home = () => {
  const videoRefs = useRef([]);

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

  const navigate = useNavigate();
  const products = [
    { name: "Coriander Powder", image: coriander },
    { name: "Cumin Powder", image: cumin },
    { name: "Garam Masala", image: garamMasala },
    { name: "Red Chilli Powder", image: redChilli },
    { name: "Turmeric Powder", image: turmeric },
  ];

  return (
    <div className="bg-white">
      {/* HERO SECTION */}
      <div className="relative min-h-[60vh] md:h-[90vh] flex items-center w-full overflow-hidden px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-16 md:py-0">
        <img
          src={HeroBG}
          alt="hero"
          className="absolute inset-0 w-full h-full object-cover object-center brightness-50"
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />

        <div className="relative text-white max-w-2xl w-full">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 md:mb-4 leading-tight">
            What's the Bengol Spices story?
          </h1>

          <p className="text-xs sm:text-sm md:text-base leading-relaxed mb-5 md:mb-6">
            Bengol Spices Pvt. Ltd. is transforming the spice supply chain by
            connecting importers, wholesalers, agents, and retailers through a
            seamless digital ecosystem. From sourcing globally to delivering
            locally — we ensure quality, speed, and reliability.
          </p>

          <button
            onClick={() => navigate("/about")}
            className="bg-cyan-600 px-5 py-2.5 md:px-6 md:py-3 rounded-full text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity">
            Our Journey
          </button>
        </div>
      </div>

      {/* SERVICES SECTION */}
      <div className="bg-cyan-500 text-white px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-10 md:py-16 text-center">
        <h2 className="text-xl sm:text-2xl md:text-4xl font-semibold mb-6 md:mb-8">
          Import. Distribute. Deliver. Scale.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
          {[
            {
              title: "IMPORT & EXPORT",
              desc: "Global sourcing of premium spices with trusted suppliers.",
            },
            {
              title: "STORE MANAGEMENT",
              desc: "Retail & wholesale store creation and management.",
            },
            {
              title: "ORDER & DELIVERY",
              desc: "Agents manage orders, delivery partners handle logistics.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white text-black rounded-2xl p-5 md:p-6 text-left">
              <h3 className="font-bold text-base md:text-lg mb-2">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRODUCT GRID */}
      <div className="px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-20">
        <Typography
          variant="h5"
          className="!font-semibold !mb-8 md:!mb-12 !tracking-wide text-gray-900 !text-lg sm:!text-xl md:!text-2xl">
          Our Products
        </Typography>

        {/* Scrollable row on mobile, wrapping grid on larger screens */}
        <div className="flex gap-4 md:gap-8 overflow-x-auto scrollbar-hide py-4 md:flex-wrap md:overflow-visible">
          {products.map((item, i) => (
            <div
              key={i}
              className="
                min-w-[160px] sm:min-w-[180px] md:min-w-0 md:w-[calc(20%-26px)]
                flex-shrink-0 md:flex-shrink text-center
                bg-white/40 backdrop-blur-lg
                rounded-2xl p-3 md:p-4
                border border-white/20
                shadow-[0_10px_30px_rgba(0,0,0,0.15)]
                hover:shadow-[0_18px_45px_rgba(0,0,0,0.25)]
                transition-all duration-300
                hover:-translate-y-1
              ">
              <div
                className="
                  relative rounded-xl overflow-hidden
                  before:absolute before:inset-0
                  before:bg-gradient-to-br
                  before:from-white/40 before:via-transparent before:to-black/25
                  before:pointer-events-none
                ">
                <img
                  src={item.image}
                  alt={item.name}
                  className="
                    w-full h-[160px] sm:h-[200px] md:h-[240px] object-cover
                    rounded-xl shadow-inner border border-gray-200
                  "
                />
              </div>

              <Typography
                variant="body2"
                className="
                  !mt-3 md:!mt-4
                  !font-semibold
                  uppercase
                  tracking-[0.02em]
                  text-gray-800
                  !text-[10px] sm:!text-xs md:!text-sm
                ">
                {item.name}
              </Typography>
            </div>
          ))}
        </div>
      </div>

      {/* DIGITAL ECOSYSTEM */}
      <div className="bg-slate-100 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-20">
        {/* Parent Section Heading */}
        <div className="text-center mb-12 md:mb-20">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900">
            Our Digital Ecosystem
          </h2>

          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            A connected suite of applications designed to manage operations,
            employees, agents, orders, payments, deliveries and returns across
            the entire business ecosystem.
          </p>
        </div>

        {/* Application Showcase */}
        <div className="max-w-7xl mx-auto space-y-16 md:space-y-28">
          {[
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
          ].map((item, index) => (
            <div
              key={item.title}
              className={`flex flex-col gap-5 md:flex-row md:items-center md:gap-16 ${
                index % 2 !== 0 ? "md:flex-row-reverse" : ""
              }`}>
              {/* Mobile/Desktop Title */}
              <div className="w-full md:hidden">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="h-px w-6 bg-orange-300" />

                  <h3 className="text-xl font-semibold text-slate-900">
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Video */}
              <div className="w-full md:w-[58%]">
                <div className="group overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                  <video
                    src={item.video}
                    poster={item.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className="w-full aspect-video object-cover"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="w-full md:w-[42%]">
                {/* Desktop Number + Title */}
                <div className="hidden md:flex items-center gap-4 mb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="h-px w-8 bg-orange-300" />

                  <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                    {item.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-sm sm:text-base text-slate-600 leading-7">
                  {item.desc}
                </p>

                {/* Key Capabilities */}
                <div className="mt-5 md:mt-6">
                  <p className="text-sm font-semibold text-slate-900 mb-3">
                    Key capabilities
                  </p>

                  <ul className="space-y-2.5">
                    {item.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
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

      {/* CTA SECTION */}
      <div className="bg-purple-700 text-white px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-16 text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 md:mb-4">
          Powering the future of spice distribution
        </h2>
        <p className="text-xs sm:text-sm mb-5 md:mb-6 max-w-xl mx-auto">
          Join Bengol Spices in building a smarter, faster, and more reliable
          supply chain ecosystem.
        </p>

        <button
          className="bg-white text-purple-600 px-5 py-2.5 md:px-6 md:py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          onClick={() => navigate("/careers")}>
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Home;
