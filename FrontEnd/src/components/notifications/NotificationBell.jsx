import React, { useState } from "react";
import { NotificationsOutlined } from "@mui/icons-material";
import Badge from "@mui/material/Badge";
import NotificationPopup from "./NotificationPopup";
import useNotifications from "./useNotification";

const NotificationBell = ({ color = "#6b7280", popupPosition = "right" }) => {
  const [open, setOpen] = useState(false);

  const { notifications, loading, unreadCount, markAsRead } =
    useNotifications();

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button onClick={() => setOpen((prev) => !prev)}>
        <Badge
          badgeContent={unreadCount}
          color="error"
          overlap="circular"
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}>
          <NotificationsOutlined sx={{ fontSize: 28, color }} />
        </Badge>
      </button>

      {/* Popup */}
      {open && (
        <NotificationPopup
          notifications={notifications}
          loading={loading}
          onRead={markAsRead}
          position={popupPosition}
        />
      )}
    </div>
  );
};

export default NotificationBell;
