export const getPermissions = () => {
  try {
    const permissions = localStorage.getItem("permissions");
    return permissions ? JSON.parse(permissions) : {};
  } catch {
    // Corrupted/unreadable storage should not crash the panel
    return {};
  }
};

/**
 * Check one permission key, or an array of keys.
 *
 * An array means "any of these" — a tab guarded by
 * ["canGetAllDeliveryPartners", "canManageDeliveryPartners"] opens for an
 * employee holding either one.
 *
 * Previously this did a plain `permissions[key] === true` lookup, so passing
 * an array stringified it into a key that never exists and the tab was
 * refused even for employees who held both permissions.
 */
export const hasPermission = (key) => {
  if (!key) return true; // unguarded route

  const permissions = getPermissions();

  if (Array.isArray(key)) {
    return key.some((k) => permissions?.[k] === true);
  }

  return permissions?.[key] === true;
};

/** True when the signed-in employee may open this route entry. */
export const canAccessRoute = (route) => hasPermission(route?.permission);
