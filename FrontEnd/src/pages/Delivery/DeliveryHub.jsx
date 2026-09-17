import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PanelLayout from "../../components/layout/PanelLayout";
import NotificationBell from "../../components/notifications/NotificationBell";
import { deliveryRoutes } from "../../config/deliveryRoutes";
import { getDeliveryPartnerProfile } from "../../api/services";
import { signOutDelivery } from "./session";

const DELIVERY_ACCENT = {
  main: "#0f766e",
  soft: "rgba(15, 118, 110, 0.12)",
  surface: "linear-gradient(180deg, #f6fbfa 0%, #e9f5f3 100%)",
};

/**
 * The delivery panel uses the same shell as the Admin and Employee panels.
 * Its old header was a separate implementation whose mobile menu linked
 * Settings to a page that did not exist.
 */
const DeliveryHub = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getDeliveryPartnerProfile()
      .then((res) => {
        if (res?.data) setProfile(res.data);
      })
      .catch((error) => console.error("Failed to load profile", error));
  }, []);

  return (
    <PanelLayout
      items={deliveryRoutes}
      basePath="/delivery"
      brandTitle="Delivery Hub"
      accent={DELIVERY_ACCENT}
      storageKey="deliveryPanel"
      profile={{
        name: profile?.name || "Delivery partner",
        role: profile?.phone || "Delivery partner",
      }}
      profilePath="/delivery/profile-settings"
      onLogout={() => signOutDelivery(navigate)}
      bell={<NotificationBell color="#475569" popupPosition="right" />}
    />
  );
};

export default DeliveryHub;
