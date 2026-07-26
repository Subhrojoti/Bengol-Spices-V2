import { memo } from "react";
import { Outlet } from "react-router-dom";
import Footer from "../../components/footer/Footer";
import HomeHeader from "../../components/header/HomeHeader";

const HomeBase = () => {
  return (
    <div>
      <HomeHeader />
      <Outlet />
      <Footer />
    </div>
  );
};

export default memo(HomeBase);
