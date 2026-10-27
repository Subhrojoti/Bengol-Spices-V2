# Backend API reference

Source snapshot: 27 October 2026, including the store GPS collision and invoice download fixes. Full paths include server.js mounts.
Generated offline by `node BackEnd/scripts/review-source.mjs`; no API or production state is inferred.
See [PRODUCTION_ENHANCEMENTS.md](PRODUCTION_ENHANCEMENTS.md) for request bodies, behavior and deployment requirements.

Pipeline lists middleware and final handler. ADMIN bypasses checkPermission; permission arrays mean any one.
Controller ownership checks apply in addition. `storeOperation(handler)` serializes store mutations with admin management.

## Health

GET `/health`: database readiness, in server.js.

## /agent

Router: [agent.routes.js](../routes/agent.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/agent/apply` | `limitApplications -> inline handler -> applyAgent` | 21 |
| POST | `/agent/auth/set-password` | `limitPasswordRequests -> setPassword` | 43 |
| GET | `/agent/profile` | `protect -> isAgent -> getAgentProfile` | 46 |
| GET | `/agent/dashboard` | `protect -> isAgent -> agentDashboard` | 56 |
| GET | `/agent/leaderboard` | `protect -> isAgent -> leaderboard` | 59 |
| GET | `/agent/sales/products` | `protect -> isAgent -> getMyProductSales` | 62 |
| GET | `/agent/cash-payments` | `protect -> isAgent -> getMyCashPayments` | 65 |

## /admin

Router: [admin.routes.js](../routes/admin.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/admin/store-management` | `protect -> isAdmin -> getManagedStores` | 41 |
| POST | `/admin/store-transfers/preview` | `protect -> isAdmin -> getTransferPreview` | 42 |
| POST | `/admin/store-transfers` | `protect -> isAdmin -> executeTransfer` | 43 |
| GET | `/admin/store-management/:consumerId/removal-preview` | `protect -> isAdmin -> getRemovalPreview` | 44 |
| POST | `/admin/store-management/:consumerId/remove` | `protect -> isAdmin -> executeRemoval` | 45 |
| POST | `/admin/agents/:agentId/access` | `protect -> isAdmin -> setAgentAccess` | 46 |
| GET | `/admin/management-audit` | `protect -> isAdmin -> getManagementAudit` | 47 |
| GET | `/admin/agents/:agentId/purge-preview` | `protect -> isAdmin -> getAgentPurgePreview` | 48 |
| POST | `/admin/agents/:agentId/purge` | `protect -> isAdmin -> executeAgentPurge` | 49 |
| GET | `/admin/data-cleanups/:requestId` | `protect -> isAdmin -> getCleanupStatus` | 50 |
| POST | `/admin/data-cleanups/:requestId/retry-media` | `protect -> isAdmin -> retryCleanup` | 51 |
| PUT | `/admin/:employeeId/permissions` | `protect -> isAdmin -> updateEmployeePermissions` | 58 |
| POST | `/admin/agents/:agentId/approve` | `protect -> checkPermission("canManageAgents") -> approveAgent` | 65 |
| POST | `/admin/agents/:agentId/reject` | `protect -> checkPermission("canManageAgents") -> rejectAgent` | 72 |
| POST | `/admin/delivery-partners/:partnerId/approve` | `protect -> checkPermission("canManageDeliveryPartners") -> approveDeliveryPartner` | 79 |
| POST | `/admin/delivery-partners/:partnerId/reject` | `protect -> checkPermission("canManageDeliveryPartners") -> rejectDeliveryPartner` | 85 |
| GET | `/admin/agents` | `protect -> checkPermission("canManageAgents") -> getAllAgents` | 92 |
| GET | `/admin/dashboard-summary` | `protect -> checkPermission("canViewDashboardSummary") -> getDashboardSummary` | 95 |
| GET | `/admin/attention` | `protect -> checkPermission("canViewDashboardSummary") -> getAttentionSummary` | 103 |
| GET | `/admin/analytics/product-sales` | `protect -> checkPermission(["canViewDashboardSummary", "canManageAgents"]) -> getProductSales` | 111 |
| GET | `/admin/cash-payments` | `protect -> checkPermission("canVerifyPayments") -> getCashPayments` | 121 |
| POST | `/admin/cash-payments/approve` | `protect -> checkPermission("canVerifyPayments") -> approveCashBulk` | 122 |
| GET | `/admin/cash-payments/:paymentId` | `protect -> checkPermission("canVerifyPayments") -> getCashPaymentDetail` | 127 |
| POST | `/admin/cash-payments/:paymentId/approve` | `protect -> checkPermission("canVerifyPayments") -> approveCash` | 132 |
| POST | `/admin/cash-payments/:paymentId/reject` | `protect -> checkPermission("canVerifyPayments") -> rejectCash` | 137 |
| GET | `/admin/delivery/alerts` | `protect -> checkPermission("canAssignDelivery") -> getDeliveryAlerts` | 148 |
| GET | `/admin/delivery/orders/:orderId/trail` | `protect -> checkPermission(["canAssignDelivery", "canGetAllOrders"]) -> getDeliveryTrail` | 153 |
| POST | `/admin/delivery/orders/:orderId/retry` | `protect -> checkPermission("canAssignDelivery") -> retryDelivery` | 158 |
| POST | `/admin/delivery/orders/:orderId/allow-without-location` | `protect -> checkPermission("canAssignDelivery") -> allowWithoutLocation` | 163 |
| POST | `/admin/delivery/events/:eventId/review` | `protect -> checkPermission("canAssignDelivery") -> markDeliveryEventReviewed` | 168 |
| GET | `/admin/delivery/settings` | `protect -> checkPermission("canAssignDelivery") -> getDeliverySettings` | 173 |
| PUT | `/admin/delivery/settings` | `protect -> isAdmin -> updateDeliverySettings` | 179 |

## /employee

Router: [employee.routes.js](../routes/employee.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/employee/create` | `protect -> isAdmin -> upload.single("profilePic") -> createEmployee` | 15 |
| DELETE | `/employee/delete/:employeeId` | `protect -> isAdmin -> deleteEmployee` | 23 |
| GET | `/employee/all` | `protect -> isAdmin -> getAllEmployees` | 25 |
| GET | `/employee/profile` | `protect -> isEmployee -> getEmployeeProfile` | 27 |

## /auth

Router: [auth.routes.js](../routes/auth.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/auth/agent/login` | `limitLoginAttempts("agentId") -> agentLogin` | 20 |
| POST | `/auth/admin/login` | `limitLoginAttempts("email") -> adminLogin` | 21 |
| GET | `/auth/admin/session` | `protect -> adminSessionInfo` | 22 |
| POST | `/auth/admin/logout` | `protect -> adminLogout` | 23 |
| POST | `/auth/employee/login` | `limitLoginAttempts("employeeId") -> employeeLogin` | 24 |
| POST | `/auth/agent/forgot-password` | `limitPasswordRequests -> agentForgotPassword` | 27 |
| POST | `/auth/agent/reset-password` | `limitPasswordRequests -> agentResetPassword` | 28 |
| POST | `/auth/delivery-partner/forgot-password` | `limitPasswordRequests -> deliveryPartnerForgotPassword` | 29 |
| POST | `/auth/delivery-partner/reset-password` | `limitPasswordRequests -> deliveryPartnerResetPassword` | 34 |
| POST | `/auth/logout` | `protect -> logout` | 41 |
| POST | `/auth/employee/logout` | `protect -> employeeLogout` | 44 |
| POST | `/auth/change-password` | `protect -> changePassword` | 47 |

## /agent/store

Router: [store.routes.js](../routes/store.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/agent/store/register` | `protect -> isAgent -> agentStoreCreation -> upload.single("image") -> createStore` | 21 |
| GET | `/agent/store/my-stores` | `protect -> isAgent -> getMyStores` | 24 |
| GET | `/agent/store/:consumerId/products` | `protect -> isAgent -> getStoreCatalog` | 27 |
| POST | `/agent/store/assign-location` | `protect -> checkPermission("canAssignLocations") -> assignSalesLocation` | 30 |
| GET | `/agent/store/locations` | `protect -> checkPermission("canAssignLocations") -> getSalesLocations` | 42 |
| GET | `/agent/store/all` | `protect -> checkPermission([ "canGetAllOrders", "canAssignReturn", "canSeePaymentInfo", "canAssignDelivery", "canGetAllDeliveryPartners", "canManageDeliveryPartners", ]) -> getAllStores` | 53 |

## /agent/orders

Router: [order.routes.js](../routes/order.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/agent/orders` | `protect -> isAgent -> storeOperation(placeOrder)` | 41 |
| GET | `/agent/orders/store/:consumerId` | `protect -> getOrdersByStoreConsumerId` | 43 |
| GET | `/agent/orders/my-orders` | `protect -> isAgent -> getMyOrders` | 45 |
| GET | `/agent/orders/mine/:orderId` | `protect -> isAgent -> getMyOrder` | 47 |
| GET | `/agent/orders/all` | `protect -> checkPermission("canGetAllOrders") -> getAllOrders` | 49 |
| GET | `/agent/orders/active` | `protect -> checkPermission("canGetAllOrders") -> getActiveOrders` | 52 |
| PUT | `/agent/orders/:orderId/confirm` | `protect -> checkPermission("canConfirmOrders") -> confirmOrder` | 60 |
| PUT | `/agent/orders/:orderId/cancel` | `protect -> checkPermission("canCancelOrders") -> cancelOrder` | 66 |
| PUT | `/agent/orders/:orderId/assign` | `protect -> checkPermission("canAssignDelivery") -> assignDeliveryPartner` | 73 |
| PUT | `/agent/orders/:orderId/delivery-status` | `protect -> isDeliveryPartner -> updateDeliveryStatus` | 80 |
| POST | `/agent/orders/:orderId/could-not-deliver` | `protect -> isDeliveryPartner -> reportCouldNotDeliver` | 87 |
| POST | `/agent/orders/:orderId/collect-payment` | `protect -> isAgent -> storeOperation(collectPayment)` | 95 |
| GET | `/agent/orders/:orderId/payments` | `protect -> checkPermission("canSeePaymentInfo") -> getOrderPayments` | 98 |
| GET | `/agent/orders/due-orders` | `protect -> isAgent -> getAgentDueOrders` | 106 |
| GET | `/agent/orders/complete-payment-summary` | `protect -> checkPermission("canSeePaymentInfo") -> getCompletePaymentSummary` | 109 |
| GET | `/agent/orders/agent-collection-performance` | `protect -> checkPermission("canSeePaymentInfo") -> getAgentCollectionPerformance` | 117 |
| POST | `/agent/orders/razorpay/create` | `protect -> isAgent -> storeOperation(createRazorpayOrder)` | 125 |
| POST | `/agent/orders/razorpay/verify` | `protect -> isAgent -> storeOperation(verifyRazorpayPayment)` | 126 |
| POST | `/agent/orders/razorpay/create-initial-payment` | `protect -> isAgent -> createOrderPayment` | 129 |
| POST | `/agent/orders/razorpay/verify-initial-payment` | `protect -> isAgent -> storeOperation(verifyPaymentAndPlaceOrder)` | 135 |
| POST | `/agent/orders/razorpay/create-initial-qr` | `protect -> isAgent -> createInitialPaymentQr` | 142 |
| POST | `/agent/orders/razorpay/create-due-qr` | `protect -> isAgent -> storeOperation(createDuePaymentQr)` | 148 |
| GET | `/agent/orders/razorpay/qr-status/:qrCodeId` | `protect -> isAgent -> checkQrPaymentStatus` | 149 |
| POST | `/agent/orders/razorpay/verify-qr-and-place-order` | `protect -> isAgent -> storeOperation(verifyQrAndPlaceOrder)` | 155 |
| POST | `/agent/orders/razorpay/verify-due-qr` | `protect -> isAgent -> storeOperation(verifyDueQrPayment)` | 161 |
| GET | `/agent/orders/payment-issues` | `protect -> checkPermission("canSeePaymentInfo") -> getPaymentIssues` | 164 |
| POST | `/agent/orders/payment-issues/:id/refund` | `protect -> isAdmin -> refundPaymentIssue` | 171 |
| POST | `/agent/orders/payment-issues/:id/resolve` | `protect -> isAdmin -> resolvePaymentIssue` | 172 |

## /delivery-partner

Router: [deliveryPartner.routes.js](../routes/deliveryPartner.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/delivery-partner/register` | `limitApplications -> upload.single("document") -> registerDeliveryPartner` | 23 |
| POST | `/delivery-partner/login` | `limitLoginAttempts("phone") -> loginDeliveryPartner` | 30 |
| POST | `/delivery-partner/logout` | `protect -> isDeliveryPartner -> logoutDeliveryPartner` | 31 |
| GET | `/delivery-partner/all` | `protect -> checkPermission("canGetAllDeliveryPartners") -> getAllDeliveryPartners` | 32 |
| GET | `/delivery-partner/orders` | `protect -> isDeliveryPartner -> getMyAssignedOrders` | 38 |
| GET | `/delivery-partner/dashboard` | `protect -> isDeliveryPartner -> getDeliveryPartnerDashboard` | 39 |
| GET | `/delivery-partner/history` | `protect -> isDeliveryPartner -> getMyDeliveryHistory` | 47 |
| GET | `/delivery-partner/:partnerId/history` | `protect -> checkPermission("canGetAllDeliveryPartners") -> getDeliveryPartnerHistory` | 50 |
| GET | `/delivery-partner/profile` | `protect -> isDeliveryPartner -> getProfile` | 57 |
| POST | `/delivery-partner/change-password` | `protect -> isDeliveryPartner -> changeDeliveryPartnerPassword` | 60 |

## /products

Router: [product.routes.js](../routes/product.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/products/create` | `protect -> checkPermission("canManageProducts") -> upload.fields([ { name: "frontImage", maxCount: 1 }, { name: "backImage", maxCount: 1 }, ]) -> createProduct` | 17 |
| GET | `/products/all` | `protect -> checkPermission(["canManageProducts", "canSetTargets"]) -> getAllProductsInternal` | 31 |
| GET | `/products/single/:productId` | `protect -> checkPermission("canManageProducts") -> getProductById` | 38 |
| PUT | `/products/update/:productId` | `protect -> checkPermission("canManageProducts") -> upload.fields([ { name: "frontImage", maxCount: 1 }, { name: "backImage", maxCount: 1 }, ]) -> updateProduct` | 44 |
| DELETE | `/products/delete/:productId` | `protect -> checkPermission("canManageProducts") -> deleteProduct` | 55 |
| GET | `/products/public/allProduct` | `optionalAuth -> getAllPublicProducts` | 64 |
| GET | `/products/public/:productId` | `optionalAuth -> getSinglePublicProduct` | 65 |

## /returns

Router: [return.routes.js](../routes/return.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| POST | `/returns/:orderId/initiate` | `protect -> isAgent -> storeOperation(initiateReturn)` | 19 |
| PUT | `/returns/:returnId/assign-pickup` | `protect -> checkPermission("canAssignReturn") -> storeOperation(assignReturnPickup)` | 20 |
| GET | `/returns/my-returns` | `protect -> isAgent -> getMyReturns` | 27 |
| GET | `/returns/delivery/assigned` | `protect -> isDeliveryPartner -> getAssignedReturns` | 30 |
| PUT | `/returns/delivery/:returnId/status` | `protect -> isDeliveryPartner -> storeOperation(updateReturnStatus)` | 38 |
| GET | `/returns/all` | `protect -> checkPermission("canAssignReturn") -> getAllReturns` | 46 |
| GET | `/returns/active` | `protect -> checkPermission("canAssignReturn") -> getActiveReturns` | 49 |
| PUT | `/returns/:returnId/cancel` | `protect -> isAgent -> storeOperation(cancelReturn)` | 57 |
| POST | `/returns/:returnId/cancel` | `protect -> isAgent -> storeOperation(cancelReturn)` | 60 |

## /targets

Router: [target.routes.js](../routes/target.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/targets/agent/sales-target` | `protect -> isAgent -> getMySalesTarget` | 34 |
| GET | `/targets/agent/sales-target/history` | `protect -> isAgent -> getMySalesTargetHistory` | 35 |
| POST | `/targets/agent/sales-target/incentive/start` | `protect -> isAgent -> startMyIncentive` | 41 |
| GET | `/targets/admin/sales-target` | `protect -> canSeeSalesTargets -> getSalesTargetOverview` | 51 |
| GET | `/targets/admin/sales-target/changes` | `protect -> canSeeSalesTargets -> getSalesTargetChanges` | 52 |
| GET | `/targets/admin/sales-target/agents/:agentId` | `protect -> canSeeSalesTargets -> getAgentSalesTarget` | 58 |
| PUT | `/targets/admin/sales-target/default` | `protect -> checkPermission("canSetTargets") -> saveDefaultSalesTarget` | 66 |
| PUT | `/targets/admin/sales-target/agents/:agentId` | `protect -> checkPermission("canSetTargets") -> saveAgentSalesTarget` | 72 |
| POST | `/targets/admin/create` | `protect -> checkPermission("canSetTargets") -> createTarget` | 80 |
| GET | `/targets/admin/all` | `protect -> checkPermission(["canSetTargets", "canManageAgents"]) -> getAllTargets` | 88 |
| GET | `/targets/admin/agents` | `protect -> checkPermission(["canSetTargets", "canManageAgents"]) -> getTargetAgents` | 96 |
| PATCH | `/targets/admin/:id` | `protect -> checkPermission("canSetTargets") -> updateTarget` | 104 |
| POST | `/targets/admin/:id/end` | `protect -> checkPermission("canSetTargets") -> endTarget` | 112 |
| GET | `/targets/agent/today-target` | `protect -> isAgent -> getTodayTarget` | 120 |
| GET | `/targets/admin/performance` | `protect -> checkPermission(["canSetTargets", "canManageAgents"]) -> getTargetPerformance` | 126 |

## /api/notifications

Router: [notification.routes.js](../routes/notification.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/api/notifications` | `protect -> getMyNotifications` | 15 |
| PATCH | `/api/notifications/:id/read` | `protect -> markAsRead` | 16 |
| GET | `/api/notifications/audience` | `protect -> checkPermission("canManageNotifications") -> getNotificationAudience` | 19 |
| GET | `/api/notifications/sent` | `protect -> checkPermission("canManageNotifications") -> getSentNotifications` | 27 |
| POST | `/api/notifications/send` | `protect -> checkPermission("canManageNotifications") -> sendCustomNotification` | 34 |

## /api/faqs

Router: [faq.routes.js](../routes/faq.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/api/faqs` | `getFAQs` | 6 |

## /api/invoice

Router: [invoice.routes.js](../routes/invoice.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/api/invoice/download/:orderId` | `protect -> downloadInvoice` | 8 |

## /api/incentives

Router: [incentive.routes.js](../routes/incentive.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/api/incentives/list` | `protect -> checkPermission("canPayoutIncentives") -> getAgentIncentiveList` | 15 |
| GET | `/api/incentives/summary` | `protect -> isAgent -> getAgentIncentiveSummary` | 23 |
| POST | `/api/incentives/payout` | `protect -> checkPermission("canPayoutIncentives") -> payoutIncentive` | 25 |
| GET | `/api/incentives/history` | `protect -> isAgent -> getIncentiveHistory` | 32 |

## /api/events

Router: [events.routes.js](../routes/events.routes.js).

| Method | Full path | Pipeline and handler | Router line |
|---|---|---|---|
| GET | `/api/events/stream` | `protect -> isAdminOrEmployee -> openEventStream` | 10 |

Registered method/path entries: **143**, including health. Commented routes are excluded.
