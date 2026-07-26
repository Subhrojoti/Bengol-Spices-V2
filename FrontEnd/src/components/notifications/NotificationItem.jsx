import React from "react";

const NotificationItem = ({ data, onRead }) => {
  return (
    <div
      onClick={() => !data.isRead && onRead(data._id)}
      className={`p-3 border-b cursor-pointer transition ${
        data.isRead ? "bg-white" : "bg-green-50"
      } hover:bg-gray-100`}>
      <div className="flex justify-between items-start">
        <h4 className="text-sm text-gray-600 font-semibold">{data.title}</h4>

        {!data.isRead && (
          <span className="w-2 h-2 bg-green-500 rounded-full mt-1" />
        )}
      </div>

      <p className="text-xs text-gray-600 mt-1">{data.message}</p>

      <p className="text-[10px] text-gray-400 mt-1">
        {new Date(data.createdAt).toLocaleString()}
      </p>
    </div>
  );
};

export default NotificationItem;
