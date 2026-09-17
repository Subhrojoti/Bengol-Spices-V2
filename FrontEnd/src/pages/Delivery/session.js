import { deliveryLogout } from "../../api/services";

/**
 * Signs the delivery partner out everywhere in the panel.
 *
 * The profile page's Logout button used to only navigate to the login page.
 * The token was still stored, so the login route sent the partner straight
 * back into the panel and logging out did nothing.
 */
export const signOutDelivery = async (navigate) => {
  try {
    await deliveryLogout();
  } catch (error) {
    // Signing out locally still has to happen if the server call fails
    console.error("Logout request failed", error);
  }

  localStorage.removeItem("deliveryToken");
  localStorage.removeItem("role");
  navigate("/delivery/login", { replace: true });
};
