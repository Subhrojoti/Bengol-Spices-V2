import React from "react";
import DeliveryHeader from "../../components/header/DeliveryHeader.jsx";
import { Outlet } from "react-router-dom";

const DeliveryHub = () => {
  return (
    <div>
      <DeliveryHeader />
      <Outlet />
    </div>
  );
};

export default DeliveryHub;
