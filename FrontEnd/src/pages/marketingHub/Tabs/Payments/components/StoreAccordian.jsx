import { useState } from "react";
import { Avatar, Typography } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import InventoryIcon from "@mui/icons-material/Inventory";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import OrderRow from "./OrderRow";

const StoreAccordion = ({ store, onPayNow }) => {
  const [open, setOpen] = useState(false);

  const {
    storeName,
    ownerName,
    image,
    orders,
    consumerId,
    address,
    phone = [],
  } = store || {};

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4 bg-white">
      {/* Accordion Header */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(!open)}>
        {/* Left Section */}
        <div className="flex items-start md:items-center gap-3 w-full">
          {/* Avatar */}
          <Avatar
            variant="rounded"
            src={image?.url || ""}
            sx={{
              width: { xs: 40, md: 56 },
              height: { xs: 40, md: 56 },
              bgcolor: "primary.main",
            }}>
            {!image?.url && <StorefrontIcon />}
          </Avatar>

          {/* Store Details */}
          <div className="flex-1 min-w-0">
            <Typography
              fontWeight={600}
              className="text-sm md:text-base break-words">
              {storeName} - {consumerId}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              className="text-xs md:text-sm">
              Owner: {ownerName}
            </Typography>

            {/* Location */}
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 flex-wrap">
              <LocationOnIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
              <span className="break-words">
                {address.city}, {address.state}
              </span>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <PhoneIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
              <span>{phone}</span>
            </div>
          </div>
        </div>

        {/* Right Section (Desktop) / Bottom (Mobile) */}
        <div className="flex items-center justify-between mt-2 md:mt-0 md:ml-4">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-600">Total Orders:</span>
            <Typography fontWeight={600}>
              {orders.filter((order) => order.status !== "CANCELLED").length}
            </Typography>
          </div>

          <ExpandMoreIcon
            className={`ml-2 transition-transform duration-300 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
      </div>

      {/* Accordion Body */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}>
        <div className="overflow-hidden">
          <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
            {orders
              .filter((order) => order.status !== "CANCELLED")
              .map((order) => (
                <OrderRow
                  key={order.orderNo}
                  order={order}
                  onPayNow={onPayNow}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreAccordion;
