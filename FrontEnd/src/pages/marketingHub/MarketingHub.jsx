import React from "react";
import AgentHeader from "../../components/header/AgentHeader.jsx";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../../components/footer/Footer.jsx";
import { footerRoutes } from "../../config/footerRoutes";

const MarketingHub = () => {
  const { pathname } = useLocation();

  // check if current route matches any footer route
  const isFooterPage = footerRoutes.some((route) =>
    pathname.includes(`/marketing/${route.path}`),
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hide header on footer pages */}
      {!isFooterPage && <AgentHeader />}

      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
};

export default MarketingHub;
