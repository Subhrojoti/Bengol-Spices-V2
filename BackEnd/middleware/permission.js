/**
 * Gate a route behind an employee permission.
 *
 * Accepts a single key, or an array meaning "any one of these" — a store
 * directory, for example, is needed both by whoever handles orders and
 * whoever handles returns. Passing a string behaves exactly as before.
 */
export const checkPermission = (permissionKey) => {
  const required = Array.isArray(permissionKey) ? permissionKey : [permissionKey];

  return (req, res, next) => {
    // Admin always allowed
    if (req.user.role === "ADMIN") {
      return next();
    }

    if (req.user.role !== "EMPLOYEE") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const permissions = req.user.permissions || {};
    const allowed = required.some((key) => permissions[key] === true);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action",
      });
    }

    next();
  };
};
