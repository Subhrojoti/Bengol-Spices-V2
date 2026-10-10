/**
 * The employee permission set, grouped for readability.
 *
 * Keys must match the `permissions` paths on the Employee model exactly — a
 * typo here silently grants nothing. Kept in one file because both the admin
 * editor and an employee's own profile render this list, and two copies
 * would drift.
 */
export const PERMISSION_GROUPS = [
  {
    group: "Orders",
    items: [
      { key: "canGetAllOrders", label: "View All Orders" },
      { key: "canConfirmOrders", label: "Confirm Orders" },
      { key: "canCancelOrders", label: "Cancel Orders" },
      { key: "canAssignDelivery", label: "Assign Delivery" },
      { key: "canAssignReturn", label: "Assign Returns" },
    ],
  },
  {
    group: "People",
    items: [
      { key: "canManageAgents", label: "Manage Agents" },
      { key: "canAssignLocations", label: "Assign Locations" },
      { key: "canPayoutIncentives", label: "Manage Incentives" },
      { key: "canGetAllDeliveryPartners", label: "View Delivery Partners" },
      { key: "canManageDeliveryPartners", label: "Manage Delivery Partners" },
    ],
  },
  {
    group: "Catalog",
    items: [{ key: "canManageProducts", label: "Manage Products" }],
  },
  {
    group: "Performance",
    items: [
      { key: "canViewDashboardSummary", label: "View Dashboard Summary" },
      { key: "canSeePaymentInfo", label: "View Payment Info" },
      { key: "canVerifyPayments", label: "Verify Cash Payments" },
      { key: "canSetTargets", label: "Manage Daily Targets" },
      { key: "canManageNotifications", label: "Manage Notifications" },
    ],
  },
];

export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);
