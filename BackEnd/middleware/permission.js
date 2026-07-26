export const checkPermission = (permissionKey) => {
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

    if (!req.user.permissions || !req.user.permissions[permissionKey]) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action",
      });
    }

    next();
  };
};
