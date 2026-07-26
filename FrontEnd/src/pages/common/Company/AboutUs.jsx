import React from "react";
import Slide7 from "../../../assets/Slides/Slide7.png";
import Slide8 from "../../../assets/Slides/Slide8.png";
import logo from "../../../assets/logo/logoGold.png";
import logoBG from "../../../assets/logo/BS_Logo_BG.png";
import fssaiLogo from "../../../assets/logo/FSSAI_Logo.png";

const AboutUs = () => {
  return (
    <div className="bg-white">
      {/* HERO QUOTE */}
      <div className="relative px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-20 flex flex-col items-center text-center overflow-hidden">
        {/* Background Image */}
        <img
          src={logoBG}
          alt="background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/70"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          <img
            src={logo}
            alt="Bengol Spices"
            className="h-28 sm:h-36 md:h-56 lg:h-72 mb-5 md:mb-8 object-contain"
          />

          <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-light max-w-5xl leading-relaxed tracking-wide text-white px-2">
            Our mission is to bring authentic Indian spices closer to every
            kitchen by creating a seamless supply chain between wholesalers,
            agents, and retailers. We believe quality and convenience should go
            hand in hand.
          </p>
        </div>
      </div>

      {/* WHAT WE STAND FOR */}
      <div className="bg-gray-100 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 mb-8 md:mb-12">
          What We Stand For
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-10 text-center">
          <div>
            <h3 className="text-base md:text-lg font-medium mb-2 md:mb-3">
              Authenticity
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              We ensure every spice reflects true Indian origin, preserving
              taste, aroma, and quality at every step.
            </p>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-medium mb-2 md:mb-3">
              Reliability
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              From sourcing to delivery, we maintain a consistent and dependable
              supply chain for our partners.
            </p>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-medium mb-2 md:mb-3">
              Efficiency
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Our streamlined system connects wholesalers, agents, and retailers
              seamlessly, reducing delays and complexity.
            </p>
          </div>
        </div>
      </div>

      {/* SPLIT SECTION - Built for Efficiency */}
      <div className="flex flex-col md:grid md:grid-cols-2">
        {/* Text first on mobile */}
        <div className="bg-green-500 text-white p-8 md:p-10 flex flex-col justify-center">
          <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">
            Built for Efficiency
          </h2>
          <p className="text-sm leading-6">
            Our platform ensures that agents can place orders seamlessly,
            businesses receive products on time, and delivery partners can
            operate efficiently. We eliminate traditional friction in the
            wholesale supply chain.
          </p>
        </div>

        {/* Image below text on mobile */}
        <img
          src={Slide7}
          alt="spices"
          className="w-full h-56 sm:h-72 md:h-full object-cover"
        />
      </div>

      {/* SECOND SPLIT - Our Network */}
      <div className="flex flex-col-reverse md:grid md:grid-cols-2">
        {/* Image second on mobile (reversed so text shows first) */}
        <img
          src={Slide8}
          alt="food"
          className="w-full h-56 sm:h-72 md:h-full object-cover"
        />

        {/* Text first on mobile */}
        <div className="bg-orange-500 text-white p-8 md:p-10 flex flex-col justify-center">
          <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">
            Our Network
          </h2>
          <p className="text-sm leading-6">
            From sourcing premium spices to delivering them across cities,
            Bengol Spices Pvt. Ltd. connects every node in the ecosystem —
            ensuring consistency, quality, and trust at every step.
          </p>
        </div>
      </div>

      {/* CONTACT SECTION */}
      <div className="bg-gray-100 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
        {/* LEFT CONTENT */}
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-3 md:mb-4">
            Get In Touch
          </h2>
          <h3 className="text-lg md:text-xl text-orange-500 mb-3 md:mb-4">
            Head Office
          </h3>

          <p className="text-sm text-gray-700 leading-relaxed">
            BENGOL SPICES PRIVATE LIMITED <br />
            23/23, Kalipur Kancha Road, Marich Jhapi, Paschim Putiary, <br />
            Kolkata - 700082, West Bengal
          </p>

          {/* FSSAI BLOCK */}
          <div className="mt-5 flex items-center gap-3">
            <img
              src={fssaiLogo}
              alt="FSSAI License"
              className="h-16 md:h-20 w-auto object-contain"
            />
            <div className="text-sm leading-tight mt-4">
              <p className="font-medium text-gray-800">FSSAI Licensed</p>
              <p className="text-gray-500">License No: 12825019002131</p>
            </div>
          </div>

          <a
            href="https://www.google.com/maps/place/23%2F23,+Kalipur+Kancha+Rd,+Marich+Jhapi,+Paschim+Putiary,+Kolkata,+West+Bengal+700082/@22.4776054,88.3324406,20.38z"
            target="_blank"
            rel="noopener noreferrer">
            <button className="mt-6 bg-green-600 hover:bg-green-700 transition text-white px-5 py-2 rounded-full text-sm">
              Get Location
            </button>
          </a>
        </div>

        {/* RIGHT MAP */}
        <div className="w-full h-[260px] sm:h-[300px] md:h-[350px] rounded-2xl overflow-hidden shadow-md">
          <iframe
            title="Google Map Location"
            src="https://www.google.com/maps?q=22.4776054,88.3324406&z=17&output=embed"
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
