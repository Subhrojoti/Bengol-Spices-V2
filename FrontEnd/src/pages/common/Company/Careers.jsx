import React from "react";
import { useNavigate } from "react-router-dom";

const Careers = () => {
  const navigate = useNavigate();

  const roles = [
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

  const [selectedRole, setSelectedRole] = React.useState(null);

  return (
    <div className="bg-white min-h-screen">
      {/* HERO SECTION */}
      <div className="bg-orange-500 text-white px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-16">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 md:mb-4">
          Join Bengol Spices
        </h1>

        <p className="max-w-2xl text-sm md:text-base leading-relaxed">
          Be a part of a fast-growing supply chain ecosystem connecting
          importers, agents, retailers, and delivery partners. Whether you
          manage orders or deliver them — you are at the heart of our system.
        </p>
      </div>

      {/* ROLES SECTION */}
      <div className="px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-10 md:py-16 bg-gray-100">
        <h2 className="text-xl sm:text-2xl font-semibold mb-7 md:mb-10">
          Explore Opportunities
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* AGENT ROLE */}
          <div className="bg-white border rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition">
            <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">
              Agent
            </h3>

            <p className="text-sm text-gray-600 mb-4 md:mb-6 leading-6">
              As an Agent, you will be responsible for placing orders, managing
              retailer relationships, and ensuring smooth order flow within your
              assigned region.
            </p>

            <ul className="text-sm text-gray-600 mb-5 md:mb-6 space-y-2">
              <li>• Manage retailer network</li>
              <li>• Place and track orders</li>
              <li>• Coordinate with delivery partners</li>
            </ul>

            <button
              onClick={() => navigate("/agent-onboarding")}
              className="bg-orange-600 text-white px-5 py-2.5 rounded-full text-sm hover:opacity-90 w-full sm:w-auto">
              Apply as Agent
            </button>
          </div>

          {/* DELIVERY PARTNER ROLE */}
          <div className="bg-white border rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition">
            <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">
              Delivery Partner
            </h3>

            <p className="text-sm text-gray-600 mb-4 md:mb-6 leading-6">
              As a Delivery Partner, you will ensure timely delivery of products
              to stores and handle returns efficiently while maintaining service
              quality.
            </p>

            <ul className="text-sm text-gray-600 mb-5 md:mb-6 space-y-2">
              <li>• Pick up and deliver orders</li>
              <li>• Handle returns and exchanges</li>
              <li>• Ensure timely delivery</li>
            </ul>

            <button
              onClick={() => navigate("/delivery-partner-register")}
              className="bg-orange-600 text-white px-5 py-2.5 rounded-full text-sm hover:opacity-90 w-full sm:w-auto">
              Apply as Delivery Partner
            </button>
          </div>
        </div>

        {/* OTHER JOB ROLES SECTION */}
        <div className="mt-12 md:mt-16">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">
            Other Opportunities
          </h2>
          <p className="text-sm text-gray-500 mb-6 md:mb-8">
            Interested in joining our team in a different capacity? Select a
            role below and apply directly.
          </p>

          <div className="bg-white border rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Apply for a Role
            </h3>
            <p className="text-sm text-gray-500 mb-5 md:mb-6">
              Select the department you'd like to join and we'll get in touch.
            </p>

            {/* Role Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-8 mb-5 md:mb-6 md:mx-8">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`text-xs sm:text-sm px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg border text-left transition font-medium ${
                    selectedRole === role
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:border-orange-400 hover:text-orange-600"
                  }`}>
                  {role}
                </button>
              ))}
            </div>

            {selectedRole && (
              <p className="text-sm text-gray-500 mb-4">
                Selected:{" "}
                <span className="font-semibold text-gray-800">
                  {selectedRole}
                </span>
              </p>
            )}

            <a
              href={
                selectedRole
                  ? `https://mail.google.com/mail/?view=cm&to=careers@bengolspices.com&su=Application for ${encodeURIComponent(selectedRole)}&body=Hi,%0A%0AI am interested in applying for the ${encodeURIComponent(selectedRole)} role at Bengol Spices.%0A%0APlease find my details below:%0A%0AName:%0APhone:%0AExperience:%0A%0AThank you.`
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!selectedRole) e.preventDefault();
              }}
              className={`inline-block px-6 py-2.5 rounded-full text-sm text-white text-center transition ${
                selectedRole
                  ? "bg-orange-600 hover:opacity-90 cursor-pointer"
                  : "bg-gray-300 cursor-not-allowed"
              }`}>
              Apply Now
            </a>
          </div>
        </div>
      </div>

      {/* CTA SECTION */}
      <div className="bg-sky-500 px-4 sm:px-6 md:px-20 lg:px-32 xl:px-40 py-12 md:py-16 text-center">
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3 md:mb-4">
          Grow with Bengol Spices
        </h2>

        <p className="text-sm text-white">
          Join our ecosystem and be part of a smarter, faster, and more reliable
          supply chain network.
        </p>
      </div>
    </div>
  );
};

export default Careers;
