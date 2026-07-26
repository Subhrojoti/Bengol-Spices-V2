import React from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo/Logo_Final.png";

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-gray-100 text-gray-700 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-10 md:py-12">
      {/* TOP SECTION */}
      <div className="flex flex-col md:flex-row w-full gap-8 md:gap-0">
        {/* LEFT - Logo */}
        <div className="flex flex-col md:w-1/4 items-center md:items-start">
          <div
            className="cursor-pointer flex items-center md:-mt-5"
            onClick={() => navigate("/")}>
            <img
              src={logo}
              alt="Bengol Spices"
              className="h-16 sm:h-20 md:h-24 object-contain"
            />
          </div>
          <p className="text-sm text-gray-500 mt-1 md:mt-2">
            © 2025 Bengol Spices
          </p>
        </div>

        {/* RIGHT - Links Grid */}
        <div className="md:w-3/4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* COLUMN 1 - COMPANY */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
              Company
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="about" className="hover:text-black cursor-pointer">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="careers" className="hover:text-black cursor-pointer">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 2 - CONTACT */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
              Contact Us
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="help" className="hover:text-black cursor-pointer">
                  Help & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3 - LEGAL */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
              Legal
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="terms" className="hover:text-black cursor-pointer">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link to="privacy" className="hover:text-black cursor-pointer">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 4 - AVAILABLE */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
              Available in
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>West Bengal</li>
              <li>Delhi</li>
              <li>Uttar Pradesh</li>
              <li>Bihar</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
