import React from "react";
import { Typography } from "@mui/material";
import coriander from "../../../assets/products/BS_Coriander_Powder.jpeg";
import cumin from "../../../assets/products/BS_Cumin_Powder.jpeg";
import garamMasala from "../../../assets/products/BS_Garam_Masala.jpeg";
import redChilli from "../../../assets/products/BS_Red_Chilli_Powder.jpeg";
import turmeric from "../../../assets/products/BS_Turmeric_Powder.jpeg";
import { useNavigate } from "react-router-dom";
import HeroBG from "../../../assets/logo/BS_Home.png";

const Home = () => {
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

      {/* SYSTEM ARCHITECTURE */}
      <div className="bg-gray-100 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-10 md:py-16">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-center mb-6 md:mb-10">
          Our Digital Ecosystem
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-center">
          {[
            {
              title: "Admin App",
              desc: "Controls operations, analytics & system management.",
            },
            {
              title: "Employee App",
              desc: "Handles internal workflows and store management.",
            },
            {
              title: "Agent App",
              desc: "Places orders and manages retailer relationships.",
            },
            {
              title: "Delivery App",
              desc: "Handles logistics, delivery & returns efficiently.",
            },
          ].map((item, i) => (
            <div key={i} className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">
                {item.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-600">{item.desc}</p>
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
