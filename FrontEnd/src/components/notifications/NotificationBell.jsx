import React, { useState } from "react";
import { NotificationsOutlined } from "@mui/icons-material";
import Badge from "@mui/material/Badge";
import NotificationPopup from "./NotificationPopup";
import useNotifications from "./useNotification";
import { useThemeMode } from "../../theme/useThemeMode";

const NotificationBell = ({ color = "#6b7280", popupPosition = "right" }) => {
  const [open, setOpen] = useState(false);
  // The grey a panel asks for is chosen for a white top bar
  const { dark } = useThemeMode();
  const iconColor = dark ? "#a9b6c8" : color;

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
          <NotificationsOutlined sx={{ fontSize: 28, color: iconColor }} />
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
