export const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }
  next();
};

export const isAgent = (req, res, next) => {
  if (req.user.role !== "AGENT") {
    return res.status(403).json({
      success: false,
      message: "Agent access only",
    });
  }
  next();
};

export const isDeliveryPartner = (req, res, next) => {
  if (req.user.role !== "DELIVERY_PARTNER") {
    return res.status(403).json({
      success: false,
      message: "DELIVERY PARTNER access only",
    });
  }
  next();
};

export const isAdminOrEmployee = (req, res, next) => {
  if (req.user.role === "ADMIN" || req.user.role === "EMPLOYEE") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied",
  });
};

/* Nothing routes through this today; checkPermission("canManageProducts")
   is what the product routes use. It is kept working rather than left as a
   trap: it read req.user.canManageProducts, which is never set. The auth
   middleware puts an employee's permissions on req.user.permissions, so the
   old check was always undefined and every employee was refused. */
export const isAdminOrAllowedEmployee = (req, res, next) => {
  if (req.user.role === "ADMIN") return next();

  if (
    req.user.role === "EMPLOYEE" &&
    req.user.permissions?.canManageProducts === true
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied",
  });
};

// Employee Access Middleware
export const isEmployee = (req, res, next) => {
  if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      success: false,
      message: "EMPLOYEE access only",
    });
  }
  next();
};
