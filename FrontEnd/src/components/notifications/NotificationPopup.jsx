import React from "react";
import NotificationItem from "./NotificationItem";

const NotificationPopup = ({
  notifications,
  loading,
  onRead,
  position = "right",
}) => {
  const positionClass = position === "left" ? "left-0" : "right-0";

  return (
    <div
      className={`absolute ${positionClass} mt-2 w-80 bg-white shadow-lg rounded-xl border z-50 overflow-hidden`}>
      <div className="p-3 font-semibold text-green-800 border-b">
        Notifications
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-sm">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">
            No notifications
          </p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n._id} data={n} onRead={onRead} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPopup;
