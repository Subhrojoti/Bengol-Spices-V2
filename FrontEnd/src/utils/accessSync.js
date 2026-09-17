/**
 * Decision rules for keeping an employee's session in step with the access
 * the admin has granted them. Kept free of React and network imports so the
 * rules can be exercised directly — wrongly signing someone out mid-work is
 * worse than syncing a little late, so these need to be verifiable.
 */

/**
 * A stable fingerprint of the permissions an employee currently holds.
 * Only granted keys matter, and order must not, so an admin toggling a
 * permission off and back on leaves the fingerprint unchanged.
 */
export const permissionSignature = (permissions) =>
  Object.keys(permissions || {})
    .filter((key) => permissions[key] === true)
    .sort()
    .join("|");

/**
 * Decide what a single poll result means.
 *
 * @param {object} args
 * @param {object} args.result   from fetchEmployeeAccessState
 * @param {string|null} args.baseline  signature captured when the panel loaded
 * @returns {{action: "none"|"signout", reason?: string, message?: string,
 *            permissions?: object}}
 */
export const evaluateAccess = ({ result, baseline }) => {
  if (!result?.ok) {
    // Offline, timed out or the server erred — say nothing and retry later.
    if (result?.reason === "INVALID_SESSION") {
      return {
        action: "signout",
        reason: "INVALID_SESSION",
        message: "Your session has ended. Please sign in again.",
      };
    }
    return { action: "none" };
  }

  const employee = result.employee;
  if (!employee) return { action: "none" };

  if (employee.status && employee.status !== "ACTIVE") {
    return {
      action: "signout",
      reason: "DEACTIVATED",
      message: "Your account has been deactivated by the administrator.",
    };
  }

  const current = permissionSignature(employee.permissions);

  if (baseline !== null && baseline !== undefined && current !== baseline) {
    return {
      action: "signout",
      reason: "PERMISSIONS_CHANGED",
      message:
        "Your access permissions were updated by the administrator. Please sign in again to continue.",
      permissions: employee.permissions || {},
    };
  }

  return { action: "none" };
};
