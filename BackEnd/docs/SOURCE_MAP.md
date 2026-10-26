# Backend source map and review snapshot

Updated 25 October 2026 after production enhancements. Original baseline HEAD: `59354fc6f86731fd74f9099e4d6036690b8b2a2e`.
See [backend context](../../BACKEND_CONTEXT.md) and [implementation report](PRODUCTION_ENHANCEMENTS.md).

## Offline validation

- Parsed **118** first-party JS/MJS files, including test and documentation scripts.
- Checked **435** relative imports: all files and static named/default exports resolve.
- Extracted **141** registered method/path entries, including health.
- This script imports no application code and connects to no services.
- Runtime tests/build results and remaining live checks are recorded in the implementation report.
- Regenerate with `node BackEnd/scripts/review-source.mjs` after backend edits; frontend development dependencies must be installed.

## Module inventory

SHA-256 fingerprints use raw source bytes; compare hashes or Git diffs before reusing these notes.

### config/cloudinary.js

[config/cloudinary.js](../config/cloudinary.js), 14 lines. SHA-256: `4a5298dc6454361160c71eba6ce037b4829e240a75803a1dc7b023fd16454f95`.

Exports: [default](../config/cloudinary.js#L13).

Package/built-in imports: `cloudinary`.

### config/razorpay.js

[config/razorpay.js](../config/razorpay.js), 39 lines. SHA-256: `05c25f68f59a542c218747c8ddab0169ff25f4d923ec6681635c5b6df13c86b3`.

Exports: [razorpayInstance](../config/razorpay.js#L33).

Package/built-in imports: `razorpay`.

### controllers/admin.auth.js

[controllers/admin.auth.js](../controllers/admin.auth.js), 59 lines. SHA-256: `4385d32b6a9a971ec425781bad78ad11a9089c078db44aae8fbf8e37df635a3a`.

Exports: [adminLogin](../controllers/admin.auth.js#L12).

Package/built-in imports: `crypto`, `jsonwebtoken`.

### controllers/admin.controller.js

[controllers/admin.controller.js](../controllers/admin.controller.js), 352 lines. SHA-256: `b9e10e7ecd21f54c6f470b6f49d8ea8b9eee83a149ab93836e99ae339610770f`.

Exports: [approveAgent](../controllers/admin.controller.js#L33), [getAllAgents](../controllers/admin.controller.js#L103), [rejectAgent](../controllers/admin.controller.js#L130), [getDashboardSummary](../controllers/admin.controller.js#L187), [getAttentionSummary](../controllers/admin.controller.js#L226), [approveDeliveryPartner](../controllers/admin.controller.js#L247), [rejectDeliveryPartner](../controllers/admin.controller.js#L301).

Local imports: [models/Order.js](../models/Order.js), [models/store.js](../models/store.js), [models/Product.js](../models/Product.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/Agent.js](../models/Agent.js), [utils/email.js](../utils/email.js), [services/dashboard.service.js](../services/dashboard.service.js), [services/attention.service.js](../services/attention.service.js), [services/adminManagement.service.js](../services/adminManagement.service.js), [services/dashboardSales.service.js](../services/dashboardSales.service.js).

Package/built-in imports: `crypto`, `mongoose`.

### controllers/adminManagement.controller.js

[controllers/adminManagement.controller.js](../controllers/adminManagement.controller.js), 50 lines. SHA-256: `9540025bd8d6815ed07815bda1acd7b4cac65d284694526f571dacc58157eb8e`.

Exports: [setAgentAccess](../controllers/adminManagement.controller.js#L16), [getTransferPreview](../controllers/adminManagement.controller.js#L17), [executeTransfer](../controllers/adminManagement.controller.js#L21), [getRemovalPreview](../controllers/adminManagement.controller.js#L22), [executeRemoval](../controllers/adminManagement.controller.js#L26), [getAgentPurgePreview](../controllers/adminManagement.controller.js#L27), [executeAgentPurge](../controllers/adminManagement.controller.js#L28), [getCleanupStatus](../controllers/adminManagement.controller.js#L34), [retryCleanup](../controllers/adminManagement.controller.js#L35), [getManagedStores](../controllers/adminManagement.controller.js#L36), [getManagementAudit](../controllers/adminManagement.controller.js#L49).

Local imports: [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [models/AdminAudit.js](../models/AdminAudit.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [services/adminManagement.service.js](../services/adminManagement.service.js), [services/agentPurge.service.js](../services/agentPurge.service.js), [services/mediaCleanup.service.js](../services/mediaCleanup.service.js).

### controllers/agent.controller.js

[controllers/agent.controller.js](../controllers/agent.controller.js), 675 lines. SHA-256: `0505118414dc46a428109ca3a0e88f6c335177f42cf24fd75f76c1a986477b63`.

Exports: [applyAgent](../controllers/agent.controller.js#L101), [getAgentProfile](../controllers/agent.controller.js#L406), [assignSalesLocation](../controllers/agent.controller.js#L444), [agentDashboard](../controllers/agent.controller.js#L559), [leaderboard](../controllers/agent.controller.js#L602), [getSalesLocations](../controllers/agent.controller.js#L650).

Local imports: [models/Agent.js](../models/Agent.js), [utils/email.js](../utils/email.js), [config/cloudinary.js](../config/cloudinary.js), [models/AgentSalesLocation.js](../models/AgentSalesLocation.js), [services/dashboard.service.js](../services/dashboard.service.js), [services/leaderboard.service.js](../services/leaderboard.service.js), [models/Counter.js](../models/Counter.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/Product.js](../models/Product.js), [utils/pricing.js](../utils/pricing.js), [utils/formFields.js](../utils/formFields.js), [utils/publicError.js](../utils/publicError.js), [services/agentApplication.service.js](../services/agentApplication.service.js), [utils/salesLocation.js](../utils/salesLocation.js).

Package/built-in imports: `mongoose`.

### controllers/analytics.controller.js

[controllers/analytics.controller.js](../controllers/analytics.controller.js), 153 lines. SHA-256: `01a2046ce173223ef9196b38c7ab7184e452c6e2fe6f1e9471acc97040bbff13`.

Exports: [getProductSales](../controllers/analytics.controller.js#L55), [getMyProductSales](../controllers/analytics.controller.js#L111).

Local imports: [services/sales.service.js](../services/sales.service.js), [utils/salesTarget.js](../utils/salesTarget.js).

Package/built-in imports: `mongoose`.

### controllers/auth.controller.js

[controllers/auth.controller.js](../controllers/auth.controller.js), 650 lines. SHA-256: `23451870f74a657009eb6864829a55879541c0f205327088b9a96b87a0af21d5`.

Exports: [setPassword](../controllers/auth.controller.js#L13), [agentLogin](../controllers/auth.controller.js#L73), [changePassword](../controllers/auth.controller.js#L153), [logout](../controllers/auth.controller.js#L272), [employeeLogin](../controllers/auth.controller.js#L287), [employeeLogout](../controllers/auth.controller.js#L368), [agentForgotPassword](../controllers/auth.controller.js#L539), [agentResetPassword](../controllers/auth.controller.js#L585), [deliveryPartnerForgotPassword](../controllers/auth.controller.js#L598), [deliveryPartnerResetPassword](../controllers/auth.controller.js#L639).

Local imports: [models/Agent.js](../models/Agent.js), [models/Employee.js](../models/Employee.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [utils/email.js](../utils/email.js), [utils/frontendUrl.js](../utils/frontendUrl.js), [utils/agentAccess.js](../utils/agentAccess.js).

Package/built-in imports: `bcryptjs`, `jsonwebtoken`, `crypto`.

### controllers/cashVerification.controller.js

[controllers/cashVerification.controller.js](../controllers/cashVerification.controller.js), 170 lines. SHA-256: `1aeeaa5b779f025b2289f8f0336866221a9feb13ef8d4584e184035dfec53cd6`.

Exports: [getCashPayments](../controllers/cashVerification.controller.js#L28), [getCashPaymentDetail](../controllers/cashVerification.controller.js#L55), [approveCash](../controllers/cashVerification.controller.js#L70), [approveCashBulk](../controllers/cashVerification.controller.js#L94), [rejectCash](../controllers/cashVerification.controller.js#L130), [getMyCashPayments](../controllers/cashVerification.controller.js#L158).

Local imports: [services/cashVerification.service.js](../services/cashVerification.service.js).

### controllers/delivery.controller.js

[controllers/delivery.controller.js](../controllers/delivery.controller.js), 254 lines. SHA-256: `8b1662a52ded46180c80daa2fe452353375781ff2683ccf6e183de1bb08bc311`.

Exports: [reportCouldNotDeliver](../controllers/delivery.controller.js#L34), [getDeliveryAlerts](../controllers/delivery.controller.js#L161), [getDeliveryTrail](../controllers/delivery.controller.js#L171), [markDeliveryEventReviewed](../controllers/delivery.controller.js#L187), [retryDelivery](../controllers/delivery.controller.js#L205), [allowWithoutLocation](../controllers/delivery.controller.js#L217), [getSettings](../controllers/delivery.controller.js#L228), [updateSettings](../controllers/delivery.controller.js#L237).

Local imports: [models/Order.js](../models/Order.js), [services/deliveryTrail.service.js](../services/deliveryTrail.service.js), [utils/geo.js](../utils/geo.js).

### controllers/deliveryPartner.controller.js

[controllers/deliveryPartner.controller.js](../controllers/deliveryPartner.controller.js), 756 lines. SHA-256: `eaccdc4bdfa9b8d86dad404a76de564886794dce61d93aea83e0058f9b299232`.

Exports: [registerDeliveryPartner](../controllers/deliveryPartner.controller.js#L16), [loginDeliveryPartner](../controllers/deliveryPartner.controller.js#L173), [logoutDeliveryPartner](../controllers/deliveryPartner.controller.js#L270), [getAllDeliveryPartners](../controllers/deliveryPartner.controller.js#L302), [getMyAssignedOrders](../controllers/deliveryPartner.controller.js#L347), [getDeliveryPartnerDashboard](../controllers/deliveryPartner.controller.js#L388), [getProfile](../controllers/deliveryPartner.controller.js#L560), [getMyDeliveryHistory](../controllers/deliveryPartner.controller.js#L624), [getDeliveryPartnerHistory](../controllers/deliveryPartner.controller.js#L637), [changeDeliveryPartnerPassword](../controllers/deliveryPartner.controller.js#L666).

Local imports: [models/DeliveryPartner.js](../models/DeliveryPartner.js), [config/cloudinary.js](../config/cloudinary.js), [models/Order.js](../models/Order.js), [models/Return.js](../models/Return.js), [models/Agent.js](../models/Agent.js), [utils/formFields.js](../utils/formFields.js), [utils/publicError.js](../utils/publicError.js), [services/deliveryTrail.service.js](../services/deliveryTrail.service.js).

Package/built-in imports: `bcryptjs`, `jsonwebtoken`, `mongoose`.

### controllers/employee.controller.js

[controllers/employee.controller.js](../controllers/employee.controller.js), 418 lines. SHA-256: `a34fef68b56976f3b51b165ee681b0e67bc7da16e01acee22c1a2537e48c4b24`.

Exports: [createEmployee](../controllers/employee.controller.js#L22), [getAllEmployees](../controllers/employee.controller.js#L211), [updateEmployeePermissions](../controllers/employee.controller.js#L232), [getEmployeeProfile](../controllers/employee.controller.js#L343), [deleteEmployee](../controllers/employee.controller.js#L371).

Local imports: [models/Employee.js](../models/Employee.js), [models/Counter.js](../models/Counter.js), [utils/email.js](../utils/email.js), [services/notification.service.js](../services/notification.service.js), [config/cloudinary.js](../config/cloudinary.js).

Package/built-in imports: `bcryptjs`.

### controllers/faq.controller.js

[controllers/faq.controller.js](../controllers/faq.controller.js), 19 lines. SHA-256: `f733d57153792e8adff6e4127a543d5d30326ee675ea2df789a5e5407b4a4436`.

Exports: [getFAQs](../controllers/faq.controller.js#L4).

Local imports: [models/FAQ.js](../models/FAQ.js).

### controllers/incentive.controller.js

[controllers/incentive.controller.js](../controllers/incentive.controller.js), 322 lines. SHA-256: `db259c5b316eee3f77ec3afb6eed5c67948046f096edf47c344d70fd33a28922`.

Exports: [getAgentIncentiveList](../controllers/incentive.controller.js#L17), [payoutIncentive](../controllers/incentive.controller.js#L137), [getAgentIncentiveSummary](../controllers/incentive.controller.js#L257), [getIncentiveHistory](../controllers/incentive.controller.js#L302).

Local imports: [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), [models/Agent.js](../models/Agent.js), [services/payment.service.js](../services/payment.service.js).

### controllers/invoice.controller.js

[controllers/invoice.controller.js](../controllers/invoice.controller.js), 110 lines. SHA-256: `57de49af284d8eabc208de4a285aad3b869ac5e7097bed6c5ab884c8a7852f2f`.

Exports: [downloadInvoice](../controllers/invoice.controller.js#L43).

Local imports: [models/Invoice.js](../models/Invoice.js), [models/Order.js](../models/Order.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [utils/invoiceNumber.js](../utils/invoiceNumber.js), [utils/uploadPdf.js](../utils/uploadPdf.js), [services/invoice.service.js](../services/invoice.service.js).

### controllers/notification.controller.js

[controllers/notification.controller.js](../controllers/notification.controller.js), 286 lines. SHA-256: `34d04a573625160ca59e5205771a00155e38dd8e101e641055664a0d732df4b9`.

Exports: [getMyNotifications](../controllers/notification.controller.js#L13), [markAsRead](../controllers/notification.controller.js#L33), [sendCustomNotification](../controllers/notification.controller.js#L58), [getNotificationAudience](../controllers/notification.controller.js#L188), [getSentNotifications](../controllers/notification.controller.js#L225).

Local imports: [models/Notification.js](../models/Notification.js), [models/Employee.js](../models/Employee.js), [models/Agent.js](../models/Agent.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js).

Package/built-in imports: `crypto`, `mongoose`.

### controllers/order.controller.js

[controllers/order.controller.js](../controllers/order.controller.js), 3094 lines. SHA-256: `8f58f32701b6f0302900d8d4e6f303f604191c9e62275f4e60cdc0bccfd52e86`.

Exports: [releaseStock](../controllers/order.controller.js#L182), [reserveStock](../controllers/order.controller.js#L195), [placeOrder](../controllers/order.controller.js#L237), [getOrdersByStoreConsumerId](../controllers/order.controller.js#L832), [getMyOrder](../controllers/order.controller.js#L906), [getMyOrders](../controllers/order.controller.js#L941), [getAllOrders](../controllers/order.controller.js#L971), [getActiveOrders](../controllers/order.controller.js#L1023), [confirmOrder](../controllers/order.controller.js#L1049), [cancelOrder](../controllers/order.controller.js#L1114), [assignDeliveryPartner](../controllers/order.controller.js#L1258), [updateDeliveryStatus](../controllers/order.controller.js#L1435), [collectPayment](../controllers/order.controller.js#L1749), [getOrderPayments](../controllers/order.controller.js#L1820), [getAgentDueOrders](../controllers/order.controller.js#L1840), [getCompletePaymentSummary](../controllers/order.controller.js#L1867), [getAgentCollectionPerformance](../controllers/order.controller.js#L2020), [createShipment](../controllers/order.controller.js#L2072), [createRazorpayOrder](../controllers/order.controller.js#L2117), [verifyRazorpayPayment](../controllers/order.controller.js#L2183), [createOrderPayment](../controllers/order.controller.js#L2285), [verifyPaymentAndPlaceOrder](../controllers/order.controller.js#L2336), [createInitialPaymentQr](../controllers/order.controller.js#L2498), [createDuePaymentQr](../controllers/order.controller.js#L2549), [checkQrPaymentStatus](../controllers/order.controller.js#L2616), [verifyQrAndPlaceOrder](../controllers/order.controller.js#L2666), [verifyDueQrPayment](../controllers/order.controller.js#L2794), [getPaymentIssues](../controllers/order.controller.js#L2937), [refundPaymentIssue](../controllers/order.controller.js#L3031), [resolvePaymentIssue](../controllers/order.controller.js#L3062).

Local imports: [models/Counter.js](../models/Counter.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/Employee.js](../models/Employee.js), [models/Admin.js](../models/Admin.js), [models/Order.js](../models/Order.js), [models/store.js](../models/store.js), [models/Product.js](../models/Product.js), [models/Invoice.js](../models/Invoice.js), [services/invoice.service.js](../services/invoice.service.js), [services/shiprocket.service.js](../services/shiprocket.service.js), [models/Payment.js](../models/Payment.js), [services/notification.service.js](../services/notification.service.js), [config/razorpay.js](../config/razorpay.js), [models/Agent.js](../models/Agent.js), [services/target.service.js](../services/target.service.js), [services/salesTarget.service.js](../services/salesTarget.service.js), [services/cashVerification.service.js](../services/cashVerification.service.js), [utils/pricing.js](../utils/pricing.js), [utils/paymentVerification.js](../utils/paymentVerification.js), [utils/uom.js](../utils/uom.js), [services/liveEvents.js](../services/liveEvents.js), [services/deliveryTrail.service.js](../services/deliveryTrail.service.js), [utils/geo.js](../utils/geo.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [services/payment.service.js](../services/payment.service.js).

Package/built-in imports: `crypto`, `mongoose`.

### controllers/product.controller.js

[controllers/product.controller.js](../controllers/product.controller.js), 460 lines. SHA-256: `dadcf3f5daee85d54f68362e0a5ca3edeb059a38be447552fcec494af637ed1d`.

Exports: [createProduct](../controllers/product.controller.js#L78), [getAllProductsInternal](../controllers/product.controller.js#L178), [getProductById](../controllers/product.controller.js#L196), [updateProduct](../controllers/product.controller.js#L224), [deleteProduct](../controllers/product.controller.js#L370), [getAllPublicProducts](../controllers/product.controller.js#L410), [getSinglePublicProduct](../controllers/product.controller.js#L430).

Local imports: [models/Product.js](../models/Product.js), [config/cloudinary.js](../config/cloudinary.js), [utils/uom.js](../utils/uom.js), [utils/sanitizeHtml.js](../utils/sanitizeHtml.js), [utils/publicError.js](../utils/publicError.js).

Package/built-in imports: `mongoose`.

### controllers/return.controller.js

[controllers/return.controller.js](../controllers/return.controller.js), 581 lines. SHA-256: `565173adbdd268d0549737bc6eeb963eb7bb7bc39df2b3fd2838fe3848761cf2`.

Exports: [initiateReturn](../controllers/return.controller.js#L14), [assignReturnPickup](../controllers/return.controller.js#L159), [getAssignedReturns](../controllers/return.controller.js#L252), [getActiveReturns](../controllers/return.controller.js#L335), [updateReturnStatus](../controllers/return.controller.js#L364), [getMyReturns](../controllers/return.controller.js#L443), [cancelReturn](../controllers/return.controller.js#L465), [getAllReturns](../controllers/return.controller.js#L561).

Local imports: [models/Return.js](../models/Return.js), [models/Order.js](../models/Order.js), [models/Counter.js](../models/Counter.js), [models/Agent.js](../models/Agent.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [services/notification.service.js](../services/notification.service.js), [services/payment.service.js](../services/payment.service.js), [services/storeAccess.service.js](../services/storeAccess.service.js).

Package/built-in imports: `mongoose`.

### controllers/salesTarget.controller.js

[controllers/salesTarget.controller.js](../controllers/salesTarget.controller.js), 184 lines. SHA-256: `b861d393d1cdc3c9b13db2d06aa9f31b52a960090c958fa96618dc62840fa569`.

Exports: [getMySalesTarget](../controllers/salesTarget.controller.js#L30), [getMySalesTargetHistory](../controllers/salesTarget.controller.js#L44), [startMyIncentive](../controllers/salesTarget.controller.js#L59), [getSalesTargetOverview](../controllers/salesTarget.controller.js#L76), [getAgentSalesTarget](../controllers/salesTarget.controller.js#L95), [saveDefaultSalesTarget](../controllers/salesTarget.controller.js#L145), [saveAgentSalesTarget](../controllers/salesTarget.controller.js#L146), [getSalesTargetChanges](../controllers/salesTarget.controller.js#L152).

Local imports: [services/salesTarget.service.js](../services/salesTarget.service.js), [models/SalesTargetChange.js](../models/SalesTargetChange.js), [models/Agent.js](../models/Agent.js), [utils/salesTarget.js](../utils/salesTarget.js).

### controllers/store.controller.js

[controllers/store.controller.js](../controllers/store.controller.js), 384 lines. SHA-256: `11138bc5116a56c8f45c72d1b367c3f888beb96eef7d2bf2e418ec41bba97f3a`.

Exports: [getStoreCatalog](../controllers/store.controller.js#L32), [createStore](../controllers/store.controller.js#L97), [getMyStores](../controllers/store.controller.js#L323), [getAllStores](../controllers/store.controller.js#L361).

Local imports: [models/store.js](../models/store.js), [config/cloudinary.js](../config/cloudinary.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/AgentSalesLocation.js](../models/AgentSalesLocation.js), [models/Counter.js](../models/Counter.js), [models/Product.js](../models/Product.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [services/target.service.js](../services/target.service.js), [utils/publicError.js](../utils/publicError.js), [utils/salesLocation.js](../utils/salesLocation.js), [utils/pricing.js](../utils/pricing.js).

Package/built-in imports: `crypto`.

### controllers/target.controller.js

[controllers/target.controller.js](../controllers/target.controller.js), 767 lines. SHA-256: `8c39b5215cd1f9cbda049626dff2fecb433e3a46eacd3a003696985be044cd24`.

Exports: [createTarget](../controllers/target.controller.js#L91), [updateTarget](../controllers/target.controller.js#L286), [endTarget](../controllers/target.controller.js#L375), [getTargetAgents](../controllers/target.controller.js#L432), [getTargetPerformance](../controllers/target.controller.js#L459), [getTodayTarget](../controllers/target.controller.js#L614), [getAllTargets](../controllers/target.controller.js#L683).

Local imports: [models/Target.js](../models/Target.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [services/notification.service.js](../services/notification.service.js), [services/target.service.js](../services/target.service.js), [models/Agent.js](../models/Agent.js), [models/Product.js](../models/Product.js), [utils/targets.js](../utils/targets.js).

Package/built-in imports: `mongoose`.

### database/db.js

[database/db.js](../database/db.js), 76 lines. SHA-256: `eb225eacbc96e928a714193fe4cfe416677258462edfc73acc9d6e95456c273b`.

Exports: [mongoUrl](../database/db.js#L24), [default](../database/db.js#L75).

Package/built-in imports: `mongoose`.

### middleware/auth.js

[middleware/auth.js](../middleware/auth.js), 96 lines. SHA-256: `bcb0bc47a233e8b455f7d425a8fd8791f2d8cfe43843661e94b6f6f5edb04716`.

Exports: [optionalAuth](../middleware/auth.js#L40), [authenticatedUser](../middleware/auth.js#L50), [protect](../middleware/auth.js#L84).

Local imports: [models/Agent.js](../models/Agent.js), [models/Employee.js](../models/Employee.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [utils/agentAccess.js](../utils/agentAccess.js).

Package/built-in imports: `jsonwebtoken`.

### middleware/loginLimiter.js

[middleware/loginLimiter.js](../middleware/loginLimiter.js), 108 lines. SHA-256: `ea1036360a92447a99121231910914d006718327dcd55fa120f2d66e5fc68cf2`.

Exports: [limitLoginAttempts](../middleware/loginLimiter.js#L37).

### middleware/permission.js

[middleware/permission.js](../middleware/permission.js), 37 lines. SHA-256: `b1e8255dbbc065bfa4713c894eac4327c4f35fdd92a1b518af7fc9cfb0e59621`.

Exports: [checkPermission](../middleware/permission.js#L8).

### middleware/rateLimit.js

[middleware/rateLimit.js](../middleware/rateLimit.js), 81 lines. SHA-256: `c58c2791d6d2d303e6178a20e9d808f4c6b81ae42bf6314c33dda73fdf33e710`.

Exports: [limitByAddress](../middleware/rateLimit.js#L41), [limitApplications](../middleware/rateLimit.js#L67), [limitPasswordRequests](../middleware/rateLimit.js#L75).

### middleware/role.js

[middleware/role.js](../middleware/role.js), 73 lines. SHA-256: `f83fa65f5b574ecab0d7419685b985918d775a5b9511ee9f8bb2b7c6d6d20b05`.

Exports: [isAdmin](../middleware/role.js#L1), [isAgent](../middleware/role.js#L11), [isDeliveryPartner](../middleware/role.js#L21), [isAdminOrEmployee](../middleware/role.js#L31), [isAdminOrAllowedEmployee](../middleware/role.js#L47), [isEmployee](../middleware/role.js#L64).

### middleware/upload.js

[middleware/upload.js](../middleware/upload.js), 72 lines. SHA-256: `aeb6f4c74b9675fd3c8d3597d45267ea7de10504f1ec32e230f39a90abef256d`.

Exports: [upload](../middleware/upload.js#L62).

Local imports: [utils/cloudinaryStorage.js](../utils/cloudinaryStorage.js), [config/cloudinary.js](../config/cloudinary.js).

Package/built-in imports: `multer`, `crypto`.

### models/Admin.js

[models/Admin.js](../models/Admin.js), 30 lines. SHA-256: `4bdbb1a3998314bc8c0ca445ce15192a9278fcf2e4e3c53456efd0a67b6f3453`.

Exports: [default](../models/Admin.js#L29).

Package/built-in imports: `mongoose`.

### models/AdminAudit.js

[models/AdminAudit.js](../models/AdminAudit.js), 18 lines. SHA-256: `447418b6d9f47e29665018b23f33df5f2ffdd596705c684d3e0eb4db079bfd70`.

Exports: [default](../models/AdminAudit.js#L17).

Package/built-in imports: `mongoose`.

### models/Agent.js

[models/Agent.js](../models/Agent.js), 146 lines. SHA-256: `f4f58bc6ab823c4ca025e9c6d0a62180404c48745752063d41d9350ed8d4ceea`.

Exports: [default](../models/Agent.js#L145).

Package/built-in imports: `mongoose`.

### models/AgentIncentiveLedger.js

[models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), 60 lines. SHA-256: `5df79b8c1125d458e3aca0341781ee53bd83d36d5bb85ba7700e8422d3624410`.

Exports: [default](../models/AgentIncentiveLedger.js#L59).

Package/built-in imports: `mongoose`.

### models/AgentSalesLocation.js

[models/AgentSalesLocation.js](../models/AgentSalesLocation.js), 71 lines. SHA-256: `85f552ef6772f5b507a734be312812b4d86f1134aed2f0e087b88799a71dadd4`.

Exports: [default](../models/AgentSalesLocation.js#L70).

Package/built-in imports: `mongoose`.

### models/AgentSalesPeriod.js

[models/AgentSalesPeriod.js](../models/AgentSalesPeriod.js), 92 lines. SHA-256: `27fe9bf47c7b43eb397d6ed3525a8d821f9d7361b5bd8026f7bb25056651bcaa`.

Exports: [default](../models/AgentSalesPeriod.js#L91).

Package/built-in imports: `mongoose`.

### models/AgentTargetProgress.js

[models/AgentTargetProgress.js](../models/AgentTargetProgress.js), 64 lines. SHA-256: `4abfef663d1be41b1a43ff3a80b694f7fa06ff790efa4705446bb9ed1db1d93f`.

Exports: [default](../models/AgentTargetProgress.js#L63).

Package/built-in imports: `mongoose`.

### models/Counter.js

[models/Counter.js](../models/Counter.js), 15 lines. SHA-256: `b85b67d2308e1b14ea8225606d0e3fa6bf195a63e567775220ac76f6db349aec`.

Exports: [default](../models/Counter.js#L14).

Package/built-in imports: `mongoose`.

### models/DeliveryEvent.js

[models/DeliveryEvent.js](../models/DeliveryEvent.js), 135 lines. SHA-256: `acf8c8b435a113c4680e78de27a4306eefc948d69a8482859490baeb246463a6`.

Exports: [DELIVERY_ACTIONS](../models/DeliveryEvent.js#L39), [LOCATION_PROBLEMS](../models/DeliveryEvent.js#L52), [default](../models/DeliveryEvent.js#L134).

Package/built-in imports: `mongoose`.

### models/DeliveryPartner.js

[models/DeliveryPartner.js](../models/DeliveryPartner.js), 114 lines. SHA-256: `d4a386aea9944a4a48ff4a2c7630cec65d315e1bd91706265fc050c099d9d3ba`.

Exports: [default](../models/DeliveryPartner.js#L113).

Package/built-in imports: `mongoose`.

### models/DeliverySettings.js

[models/DeliverySettings.js](../models/DeliverySettings.js), 52 lines. SHA-256: `8fddeda43136d5ec2bfa06bd7aaaf51045450dfa973ebee5b3a965a932ea0b5d`.

Exports: [DEFAULT_RADIUS_METRES](../models/DeliverySettings.js#L16), [MIN_RADIUS_METRES](../models/DeliverySettings.js#L17), [MAX_RADIUS_METRES](../models/DeliverySettings.js#L18), [default](../models/DeliverySettings.js#L51).

Package/built-in imports: `mongoose`.

### models/Employee.js

[models/Employee.js](../models/Employee.js), 81 lines. SHA-256: `c86a4c475622b15f3080ab75b060f005cff1ff3803d16758be96c3c43ed90edf`.

Exports: [default](../models/Employee.js#L80).

Package/built-in imports: `mongoose`.

### models/FAQ.js

[models/FAQ.js](../models/FAQ.js), 18 lines. SHA-256: `a6cfed81b0d0ff24f7e62da8d036c2dfd26a6c9993f98d180a360117f0bb7dc4`.

Exports: [default](../models/FAQ.js#L17).

Package/built-in imports: `mongoose`.

### models/GatewayPayment.js

[models/GatewayPayment.js](../models/GatewayPayment.js), 56 lines. SHA-256: `870dccd12ac97fd86ef6d728cf5197511a300e19c073a3772017c4fdb195c93e`.

Exports: [default](../models/GatewayPayment.js#L55).

Package/built-in imports: `mongoose`.

### models/Invoice.js

[models/Invoice.js](../models/Invoice.js), 60 lines. SHA-256: `14458da42ab1c1429e06f3cd7c6f48b9cb09fa175da0063358eeee64c9299e39`.

Exports: [default](../models/Invoice.js#L59).

Package/built-in imports: `mongoose`.

### models/MediaDeletionJob.js

[models/MediaDeletionJob.js](../models/MediaDeletionJob.js), 16 lines. SHA-256: `5141b4ff3da475bfaa71d6a43303b803a4a226c6a5ffd87c88339caf11f1929d`.

Exports: [default](../models/MediaDeletionJob.js#L15).

Package/built-in imports: `mongoose`.

### models/Notification.js

[models/Notification.js](../models/Notification.js), 63 lines. SHA-256: `580acd4b067cb5ce7ba2028d7d972741b30350a2008b59b16787a410b2b03da7`.

Exports: [default](../models/Notification.js#L62).

Package/built-in imports: `mongoose`.

### models/OperationLock.js

[models/OperationLock.js](../models/OperationLock.js), 24 lines. SHA-256: `42e18a0f2b411f055caf27c0cd9905a4b58c8589027f2df851dc3d94befaa3ac`.

Exports: [default](../models/OperationLock.js#L23).

Package/built-in imports: `mongoose`.

### models/Order.js

[models/Order.js](../models/Order.js), 396 lines. SHA-256: `dedd9b4b2720440d6bbc2c7ad916509a1862c85a1775ff44a9913cc227e1ad9c`.

Exports: [default](../models/Order.js#L395).

Package/built-in imports: `mongoose`.

### models/Payment.js

[models/Payment.js](../models/Payment.js), 105 lines. SHA-256: `bc189f922ec407e139b28bfc0431e69227f5fea567e6883005b27c1aa02c600e`.

Exports: [default](../models/Payment.js#L104).

Local imports: [utils/paymentVerification.js](../utils/paymentVerification.js).

Package/built-in imports: `mongoose`.

### models/Product.js

[models/Product.js](../models/Product.js), 177 lines. SHA-256: `a25f96ddcd1c7c08274367ab7af1505e7c491875f28ba3ccc1a2c9f4681e28e5`.

Exports: [default](../models/Product.js#L176).

Package/built-in imports: `mongoose`.

### models/Return.js

[models/Return.js](../models/Return.js), 162 lines. SHA-256: `0b4a4c1f1a7d1593fc526acd98e1a69962762ce459a90f43b246fdb803d698df`.

Exports: [default](../models/Return.js#L161).

Package/built-in imports: `mongoose`.

### models/SalesTargetChange.js

[models/SalesTargetChange.js](../models/SalesTargetChange.js), 57 lines. SHA-256: `d698e6817f48fc8c7b75af3b74ca34a27d8c678f793076185b3a2d53c23b0285`.

Exports: [default](../models/SalesTargetChange.js#L56).

Package/built-in imports: `mongoose`.

### models/SalesTargetConfig.js

[models/SalesTargetConfig.js](../models/SalesTargetConfig.js), 73 lines. SHA-256: `a78ae1f891b522c745d7720f893fdaf73d87aa0d56dc7142fd6548fffc83840c`.

Exports: [default](../models/SalesTargetConfig.js#L72).

Package/built-in imports: `mongoose`.

### models/Target.js

[models/Target.js](../models/Target.js), 102 lines. SHA-256: `18d279a57e5f484531ef87b70c06b6fde85d03db64612ba1113c30c674c26173`.

Exports: [default](../models/Target.js#L101).

Package/built-in imports: `mongoose`.

### models/store.js

[models/store.js](../models/store.js), 105 lines. SHA-256: `f104c9a67032950d669083d76bf036b9a9133f093a4a8825e6238fd4c0af99ae`.

Exports: [default](../models/store.js#L104).

Package/built-in imports: `mongoose`.

### routes/admin.routes.js

[routes/admin.routes.js](../routes/admin.routes.js), 182 lines. SHA-256: `6c0500729702f6ffce23e6deb755daa42d944950a2a3411f70d7658946c90326`.

Exports: [default](../routes/admin.routes.js#L181).

Local imports: [controllers/admin.controller.js](../controllers/admin.controller.js), [controllers/employee.controller.js](../controllers/employee.controller.js), [controllers/analytics.controller.js](../controllers/analytics.controller.js), [controllers/cashVerification.controller.js](../controllers/cashVerification.controller.js), [controllers/delivery.controller.js](../controllers/delivery.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/permission.js](../middleware/permission.js), [controllers/adminManagement.controller.js](../controllers/adminManagement.controller.js).

Package/built-in imports: `express`.

### routes/agent.routes.js

[routes/agent.routes.js](../routes/agent.routes.js), 66 lines. SHA-256: `034501f1c914d9496f0d956a1cd55899968ca329738b97d21abee619659e6f8a`.

Exports: [default](../routes/agent.routes.js#L53).

Local imports: [controllers/agent.controller.js](../controllers/agent.controller.js), [controllers/analytics.controller.js](../controllers/analytics.controller.js), [controllers/cashVerification.controller.js](../controllers/cashVerification.controller.js), [middleware/upload.js](../middleware/upload.js), [controllers/auth.controller.js](../controllers/auth.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/rateLimit.js](../middleware/rateLimit.js).

Package/built-in imports: `express`.

### routes/auth.routes.js

[routes/auth.routes.js](../routes/auth.routes.js), 48 lines. SHA-256: `fcf19849720d3f190057d701038569f3b5f7295805cd9609b488660e99dca973`.

Exports: [default](../routes/auth.routes.js#L47).

Local imports: [controllers/auth.controller.js](../controllers/auth.controller.js), [controllers/admin.auth.js](../controllers/admin.auth.js), [middleware/auth.js](../middleware/auth.js), [middleware/loginLimiter.js](../middleware/loginLimiter.js), [middleware/rateLimit.js](../middleware/rateLimit.js).

Package/built-in imports: `express`.

### routes/deliveryPartner.routes.js

[routes/deliveryPartner.routes.js](../routes/deliveryPartner.routes.js), 67 lines. SHA-256: `ee19345225740b8e2cb8687013891b763253ef18ca9bbe9996b993b0861ea5f5`.

Exports: [default](../routes/deliveryPartner.routes.js#L66).

Local imports: [controllers/deliveryPartner.controller.js](../controllers/deliveryPartner.controller.js), [middleware/upload.js](../middleware/upload.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/permission.js](../middleware/permission.js), [middleware/loginLimiter.js](../middleware/loginLimiter.js), [middleware/rateLimit.js](../middleware/rateLimit.js).

Package/built-in imports: `express`.

### routes/employee.routes.js

[routes/employee.routes.js](../routes/employee.routes.js), 30 lines. SHA-256: `fb8f90f8751924add3a40f46899db441457d7de44b49c22b8e9be4a11ba20883`.

Exports: [default](../routes/employee.routes.js#L29).

Local imports: [controllers/employee.controller.js](../controllers/employee.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/upload.js](../middleware/upload.js).

Package/built-in imports: `express`.

### routes/events.routes.js

[routes/events.routes.js](../routes/events.routes.js), 13 lines. SHA-256: `349741396e5a827fe87a3ec05045479fe557a299408edefb3b2e6320df576506`.

Exports: [default](../routes/events.routes.js#L12).

Local imports: [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [services/liveEvents.js](../services/liveEvents.js).

Package/built-in imports: `express`.

### routes/faq.routes.js

[routes/faq.routes.js](../routes/faq.routes.js), 9 lines. SHA-256: `49505a94443e91cbcf56583676c54d9a5b7d41b27b3b59df452e07002afcae93`.

Exports: [default](../routes/faq.routes.js#L8).

Local imports: [controllers/faq.controller.js](../controllers/faq.controller.js).

Package/built-in imports: `express`.

### routes/incentive.routes.js

[routes/incentive.routes.js](../routes/incentive.routes.js), 35 lines. SHA-256: `eba45e2dd7e26e41f37c815fcecf56273b00784d79816528be2e3a25f8406100`.

Exports: [default](../routes/incentive.routes.js#L34).

Local imports: [controllers/incentive.controller.js](../controllers/incentive.controller.js), [middleware/role.js](../middleware/role.js), [middleware/auth.js](../middleware/auth.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/invoice.routes.js

[routes/invoice.routes.js](../routes/invoice.routes.js), 11 lines. SHA-256: `e3a00c546517494c22fa003e39acd34f854c153c815ebbee82a911dc50152430`.

Exports: [default](../routes/invoice.routes.js#L10).

Local imports: [controllers/invoice.controller.js](../controllers/invoice.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js).

Package/built-in imports: `express`.

### routes/notification.routes.js

[routes/notification.routes.js](../routes/notification.routes.js), 42 lines. SHA-256: `460b0dd96d393b8308132a53fec7635924c90e5dd509e72b0c82a369a9f3cc85`.

Exports: [default](../routes/notification.routes.js#L41).

Local imports: [controllers/notification.controller.js](../controllers/notification.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/order.routes.js

[routes/order.routes.js](../routes/order.routes.js), 183 lines. SHA-256: `ddba83c0640f1faa8e67ea5a3f9e0d8145a32f91164b753587393afe21bc71aa`.

Exports: [default](../routes/order.routes.js#L182).

Local imports: [services/storeOperation.service.js](../services/storeOperation.service.js), [controllers/order.controller.js](../controllers/order.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [controllers/delivery.controller.js](../controllers/delivery.controller.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/product.routes.js

[routes/product.routes.js](../routes/product.routes.js), 68 lines. SHA-256: `fb4a0da78b8e5dccaf036bee61e2180320ce3220f291e2af70a8c7b029336018`.

Exports: [default](../routes/product.routes.js#L67).

Local imports: [controllers/product.controller.js](../controllers/product.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/upload.js](../middleware/upload.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/return.routes.js

[routes/return.routes.js](../routes/return.routes.js), 62 lines. SHA-256: `2a352d94928ae3e6bc1858bc83b1d315c6e95cb0e43dcea2b4d59bc15b3403ff`.

Exports: [default](../routes/return.routes.js#L61).

Local imports: [services/storeOperation.service.js](../services/storeOperation.service.js), [controllers/return.controller.js](../controllers/return.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/store.routes.js

[routes/store.routes.js](../routes/store.routes.js), 68 lines. SHA-256: `6e32a04771ee891bb340f8b5c3cef37dfced7009ef50ac8bd7d596dc70b552a2`.

Exports: [default](../routes/store.routes.js#L67).

Local imports: [controllers/store.controller.js](../controllers/store.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/role.js](../middleware/role.js), [middleware/upload.js](../middleware/upload.js), [services/storeOperation.service.js](../services/storeOperation.service.js), [controllers/agent.controller.js](../controllers/agent.controller.js), [middleware/permission.js](../middleware/permission.js).

Package/built-in imports: `express`.

### routes/target.routes.js

[routes/target.routes.js](../routes/target.routes.js), 134 lines. SHA-256: `a976f05cbfccd8942f4e543197dec0bfea6ae9378e6abe66e54ec14201e7a65b`.

Exports: [default](../routes/target.routes.js#L133).

Local imports: [controllers/target.controller.js](../controllers/target.controller.js), [controllers/salesTarget.controller.js](../controllers/salesTarget.controller.js), [middleware/auth.js](../middleware/auth.js), [middleware/permission.js](../middleware/permission.js), [middleware/role.js](../middleware/role.js).

Package/built-in imports: `express`.

### scripts/backup-db.js

[scripts/backup-db.js](../scripts/backup-db.js), 168 lines. SHA-256: `ba3d45dc8ed362977be483d9c64fd67849a33b4e5145d62a291f67ea77c287f7`.

Exports: none.

Package/built-in imports: `node:fs`, `node:os`, `node:path`, `node:zlib`, `node:events`, `node:url`, `dotenv`, `mongoose`.

### scripts/check-services.js

[scripts/check-services.js](../scripts/check-services.js), 197 lines. SHA-256: `8c19e1613ee7907c6e091d34e4477f0848614fe2fd1d23ddc2a3b8ea4228286c`.

Exports: none.

Package/built-in imports: `node:fs`, `node:path`, `node:url`, `dotenv`.

### scripts/restore-db.js

[scripts/restore-db.js](../scripts/restore-db.js), 137 lines. SHA-256: `08255b57590249ac59c861266b4b5d5a98862d562902f2b760012e7fe040f381`.

Exports: none.

Package/built-in imports: `node:fs`, `node:path`, `node:zlib`, `node:readline`, `mongoose`.

### scripts/review-source.mjs

[scripts/review-source.mjs](../scripts/review-source.mjs), 84 lines. SHA-256: `67367317ada31e4f14f32074da4eea73938a7fd3f7339f29c269cdb07750200f`.

Exports: none.

Package/built-in imports: `node:fs/promises`, `node:path`, `node:crypto`, `node:module`, `node:url`.

### server.js

[server.js](../server.js), 282 lines. SHA-256: `dd7704c33a4dff7e0f76d3d78ebe55b47560fad963da24dd282ca952fd93d61d`.

Exports: none.

Local imports: [database/db.js](../database/db.js), [routes/agent.routes.js](../routes/agent.routes.js), [routes/admin.routes.js](../routes/admin.routes.js), [routes/auth.routes.js](../routes/auth.routes.js), [routes/store.routes.js](../routes/store.routes.js), [routes/order.routes.js](../routes/order.routes.js), [routes/employee.routes.js](../routes/employee.routes.js), [routes/deliveryPartner.routes.js](../routes/deliveryPartner.routes.js), [routes/product.routes.js](../routes/product.routes.js), [routes/return.routes.js](../routes/return.routes.js), [routes/target.routes.js](../routes/target.routes.js), [routes/notification.routes.js](../routes/notification.routes.js), [routes/faq.routes.js](../routes/faq.routes.js), [routes/invoice.routes.js](../routes/invoice.routes.js), [routes/incentive.routes.js](../routes/incentive.routes.js), [routes/events.routes.js](../routes/events.routes.js), [utils/frontendUrl.js](../utils/frontendUrl.js), [utils/checkConfig.js](../utils/checkConfig.js), [services/liveEvents.js](../services/liveEvents.js), [services/invoice.service.js](../services/invoice.service.js).

Package/built-in imports: `dotenv/config`, `express`, `cors`, `mongoose`.

### services/adminManagement.service.js

[services/adminManagement.service.js](../services/adminManagement.service.js), 192 lines. SHA-256: `e28230718fc62f71ce0b639fce0267ae7a0fb60c976fcc03e12a157a37bc272e`.

Exports: [refuse](../services/adminManagement.service.js#L20), [hash](../services/adminManagement.service.js#L21), [actorOf](../services/adminManagement.service.js#L23), [relatedCounts](../services/adminManagement.service.js#L33), [confirmation](../services/adminManagement.service.js#L53), [readConfirmation](../services/adminManagement.service.js#L54), [previewTransfer](../services/adminManagement.service.js#L62), [previewRemoval](../services/adminManagement.service.js#L82), [runAdminOperation](../services/adminManagement.service.js#L98), [transferStores](../services/adminManagement.service.js#L129), [removeStore](../services/adminManagement.service.js#L146), [changeAgentAccess](../services/adminManagement.service.js#L172).

Local imports: [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [models/Return.js](../models/Return.js), [models/Invoice.js](../models/Invoice.js), [models/DeliveryEvent.js](../models/DeliveryEvent.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/AdminAudit.js](../models/AdminAudit.js), [models/MediaDeletionJob.js](../models/MediaDeletionJob.js), [services/mediaCleanup.service.js](../services/mediaCleanup.service.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [utils/agentAccess.js](../utils/agentAccess.js), [services/storeOperation.service.js](../services/storeOperation.service.js).

Package/built-in imports: `node:crypto`, `jsonwebtoken`, `mongoose`.

### services/agentApplication.service.js

[services/agentApplication.service.js](../services/agentApplication.service.js), 27 lines. SHA-256: `a82d15f1769461d1cd43976dad04ba7d2ad6c49064f6c33d5b6038d48f7c4514`.

Exports: [applicationSnapshot](../services/agentApplication.service.js#L3), [reapplyRejectedAgent](../services/agentApplication.service.js#L16).

Local imports: [models/Agent.js](../models/Agent.js).

### services/agentPurge.service.js

[services/agentPurge.service.js](../services/agentPurge.service.js), 153 lines. SHA-256: `0c101ea65ab8c10378cf6eb4895bac4868a54a81cfefd73d69050b7348c4a541`.

Exports: [previewAgentPurge](../services/agentPurge.service.js#L107), [purgeAgent](../services/agentPurge.service.js#L118).

Local imports: [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [models/Return.js](../models/Return.js), [models/Invoice.js](../models/Invoice.js), [models/DeliveryEvent.js](../models/DeliveryEvent.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [models/AgentSalesLocation.js](../models/AgentSalesLocation.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), [models/AgentSalesPeriod.js](../models/AgentSalesPeriod.js), [models/SalesTargetConfig.js](../models/SalesTargetConfig.js), [models/SalesTargetChange.js](../models/SalesTargetChange.js), [models/Target.js](../models/Target.js), [models/Notification.js](../models/Notification.js), [models/Product.js](../models/Product.js), [models/MediaDeletionJob.js](../models/MediaDeletionJob.js), [utils/uploadPdf.js](../utils/uploadPdf.js), [utils/invoiceNumber.js](../utils/invoiceNumber.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [services/storeOperation.service.js](../services/storeOperation.service.js), [services/payment.service.js](../services/payment.service.js), [services/adminManagement.service.js](../services/adminManagement.service.js), [services/mediaCleanup.service.js](../services/mediaCleanup.service.js).

Package/built-in imports: `mongoose`.

### services/attention.service.js

[services/attention.service.js](../services/attention.service.js), 292 lines. SHA-256: `cdf719c40fb4e849455515aeeb41e4ec266160489117aedf0d2a92d7880cdbbc`.

Exports: [getAttention](../services/attention.service.js#L265).

Local imports: [models/Order.js](../models/Order.js), [models/Return.js](../models/Return.js), [models/Agent.js](../models/Agent.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/Product.js](../models/Product.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), [models/Payment.js](../models/Payment.js), [services/payment.service.js](../services/payment.service.js), [services/cashVerification.service.js](../services/cashVerification.service.js), [services/deliveryTrail.service.js](../services/deliveryTrail.service.js).

### services/cashVerification.service.js

[services/cashVerification.service.js](../services/cashVerification.service.js), 609 lines. SHA-256: `b8073e8130954fb51c7eee429f60b313c86692ba5e784b019eca07fe7f79aa4a`.

Exports: [LATE_AFTER_DAYS](../services/cashVerification.service.js#L49), [MAX_BULK](../services/cashVerification.service.js#L54), [verificationSummary](../services/cashVerification.service.js#L141), [listCashPayments](../services/cashVerification.service.js#L198), [getCashPayment](../services/cashVerification.service.js#L247), [approveCashPayment](../services/cashVerification.service.js#L341), [rejectCashPayment](../services/cashVerification.service.js#L418), [approveCashPayments](../services/cashVerification.service.js#L460), [withCashVerification](../services/cashVerification.service.js#L498), [cashPaymentsOfAgent](../services/cashVerification.service.js#L552).

Local imports: [models/Payment.js](../models/Payment.js), [models/Order.js](../models/Order.js), [models/Agent.js](../models/Agent.js), [services/notification.service.js](../services/notification.service.js), [services/target.service.js](../services/target.service.js), [services/salesTarget.service.js](../services/salesTarget.service.js), [services/liveEvents.js](../services/liveEvents.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [utils/salesTarget.js](../utils/salesTarget.js), [utils/paymentVerification.js](../utils/paymentVerification.js).

Package/built-in imports: `mongoose`.

### services/dashboard.service.js

[services/dashboard.service.js](../services/dashboard.service.js), 621 lines. SHA-256: `5f9f1856f0dc33c0d7c24fc3a65338cf3cf822c41d720f357c8e10ae8325ddcc`.

Exports: [getAgentDashboard](../services/dashboard.service.js#L11), [getAdminDashboard](../services/dashboard.service.js#L291).

Local imports: [models/Order.js](../models/Order.js), [models/Return.js](../models/Return.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/store.js](../models/store.js), [models/Agent.js](../models/Agent.js), [models/Employee.js](../models/Employee.js), [models/Product.js](../models/Product.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js).

### services/dashboardSales.service.js

[services/dashboardSales.service.js](../services/dashboardSales.service.js), 82 lines. SHA-256: `a0a1b69392fe55bffe5cc5f9bacae0e595ace36341ae6669334040acbbec73be`.

Exports: [salesRanges](../services/dashboardSales.service.js#L9), [getSalesOverview](../services/dashboardSales.service.js#L31).

Local imports: [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [utils/paymentVerification.js](../utils/paymentVerification.js), [utils/salesTarget.js](../utils/salesTarget.js), [services/sales.service.js](../services/sales.service.js).

### services/deliveryTrail.service.js

[services/deliveryTrail.service.js](../services/deliveryTrail.service.js), 506 lines. SHA-256: `18f7019d922f1645b111bcc0c2c1fb4466af260d5849d8b4ea1069dadac4ef60`.

Exports: [OUT_FOR_DELIVERY_LONG_MS](../services/deliveryTrail.service.js#L35), [WITH_PARTNER](../services/deliveryTrail.service.js#L42), [CARRYING](../services/deliveryTrail.service.js#L44), [COULD_NOT_DELIVER_REASONS](../services/deliveryTrail.service.js#L48), [NOTE_MAX](../services/deliveryTrail.service.js#L58), [getDeliverySettings](../services/deliveryTrail.service.js#L67), [saveDeliverySettings](../services/deliveryTrail.service.js#L82), [actorOf](../services/deliveryTrail.service.js#L122), [storeOfOrder](../services/deliveryTrail.service.js#L149), [storePointOf](../services/deliveryTrail.service.js#L159), [recordDeliveryEvent](../services/deliveryTrail.service.js#L171), [announceDeliveryAlert](../services/deliveryTrail.service.js#L195), [deliveryTrailOf](../services/deliveryTrail.service.js#L228), [deliveryAlertCounts](../services/deliveryTrail.service.js#L277), [listDeliveryAlerts](../services/deliveryTrail.service.js#L308), [reviewDeliveryEvent](../services/deliveryTrail.service.js#L406), [requestDeliveryRetry](../services/deliveryTrail.service.js#L431), [waiveLocationCheck](../services/deliveryTrail.service.js#L467).

Local imports: [models/Order.js](../models/Order.js), [models/store.js](../models/store.js), [models/Admin.js](../models/Admin.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/DeliveryEvent.js](../models/DeliveryEvent.js), [models/DeliverySettings.js](../models/DeliverySettings.js), [services/notification.service.js](../services/notification.service.js), [services/liveEvents.js](../services/liveEvents.js), [utils/geo.js](../utils/geo.js).

Package/built-in imports: `mongoose`.

### services/invoice.service.js

[services/invoice.service.js](../services/invoice.service.js), 213 lines. SHA-256: `a75274bb8e2b77b2edd91a24505ef409cc21f76be32b117d26a964795f919449`.

Exports: [createInvoiceFromOrder](../services/invoice.service.js#L16), [updateInvoiceAfterPayment](../services/invoice.service.js#L89), [regenerateInvoicePDF](../services/invoice.service.js#L129), [secureStoredInvoices](../services/invoice.service.js#L174).

Local imports: [models/Invoice.js](../models/Invoice.js), [models/Order.js](../models/Order.js), [utils/invoiceNumber.js](../utils/invoiceNumber.js), [utils/generateInvoicePdf.js](../utils/generateInvoicePdf.js), [utils/uploadPdf.js](../utils/uploadPdf.js).

### services/leaderboard.service.js

[services/leaderboard.service.js](../services/leaderboard.service.js), 204 lines. SHA-256: `c3c048cff7d47f122bb18b5e24aa5b0edc9cfe624d253d72a0064e32ba21e47a`.

Exports: [getLeaderboard](../services/leaderboard.service.js#L7).

Local imports: [models/Agent.js](../models/Agent.js), [models/Order.js](../models/Order.js), [models/Return.js](../models/Return.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/store.js](../models/store.js).

### services/liveEvents.js

[services/liveEvents.js](../services/liveEvents.js), 120 lines. SHA-256: `e78baee591c741c4791a11c550e9a071004498db635b6ab4c3b8817b1898036c`.

Exports: [openEventStream](../services/liveEvents.js#L29), [publish](../services/liveEvents.js#L83), [closeEventStreams](../services/liveEvents.js#L110).

Local imports: [middleware/auth.js](../middleware/auth.js).

### services/mediaCleanup.service.js

[services/mediaCleanup.service.js](../services/mediaCleanup.service.js), 85 lines. SHA-256: `5b38fb0d5101e1e0dcd1c964ce5701ef6c509971e91f4c68f6886bac383b7e72`.

Exports: [mediaAssetOf](../services/mediaCleanup.service.js#L16), [assetIsReferenced](../services/mediaCleanup.service.js#L38), [getMediaCleanup](../services/mediaCleanup.service.js#L51), [processMediaCleanup](../services/mediaCleanup.service.js#L59).

Local imports: [config/cloudinary.js](../config/cloudinary.js), [models/MediaDeletionJob.js](../models/MediaDeletionJob.js), [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [models/Invoice.js](../models/Invoice.js), [models/Product.js](../models/Product.js), [models/Employee.js](../models/Employee.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [services/payment.service.js](../services/payment.service.js).

### services/notification.service.js

[services/notification.service.js](../services/notification.service.js), 89 lines. SHA-256: `3d6581ef3c500faa0f779893271595db6c6aae7ec9b81b72b577f870f92c9fec`.

Exports: [createNotification](../services/notification.service.js#L6), [sendBulkNotification](../services/notification.service.js#L71).

Local imports: [models/Notification.js](../models/Notification.js), [models/Employee.js](../models/Employee.js), [models/Agent.js](../models/Agent.js).

Package/built-in imports: `mongoose`.

### services/payment.service.js

[services/payment.service.js](../services/payment.service.js), 423 lines. SHA-256: `e8dc5385b3af7714a858c12c5350e6b12a3cc05fa9269a1e645ae6d8a7aa50ef`.

Exports: [roundRupees](../services/payment.service.js#L17), [announceCashToVerify](../services/payment.service.js#L20), [withLock](../services/payment.service.js#L70), [applyDuePayment](../services/payment.service.js#L104), [beginGatewayPayment](../services/payment.service.js#L238), [paymentsNeedingAttention](../services/payment.service.js#L278), [markGatewayPayment](../services/payment.service.js#L288), [refundGatewayPayment](../services/payment.service.js#L295), [settleFailedGatewayPayment](../services/payment.service.js#L349), [respondToClaimedGatewayPayment](../services/payment.service.js#L386).

Local imports: [models/OperationLock.js](../models/OperationLock.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [config/razorpay.js](../config/razorpay.js), [services/invoice.service.js](../services/invoice.service.js), [services/target.service.js](../services/target.service.js), [services/salesTarget.service.js](../services/salesTarget.service.js), [services/liveEvents.js](../services/liveEvents.js), [services/storeAccess.service.js](../services/storeAccess.service.js), [utils/paymentVerification.js](../utils/paymentVerification.js).

Package/built-in imports: `crypto`.

### services/sales.service.js

[services/sales.service.js](../services/sales.service.js), 805 lines. SHA-256: `46e9f1c67daceaca463fdfbe03c096595340224df051f6d6b30b3bb4b991cbf1`.

Exports: [RETURNED_STATUSES](../services/sales.service.js#L64), [eligibilityOf](../services/sales.service.js#L123), [NO_SALES](../services/sales.service.js#L168), [collectionsByAgent](../services/sales.service.js#L199), [NOTHING_UNVERIFIED](../services/sales.service.js#L269), [unverifiedByAgentMonth](../services/sales.service.js#L283), [productSales](../services/sales.service.js#L380).

Local imports: [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [models/Return.js](../models/Return.js), [models/Product.js](../models/Product.js), [models/Agent.js](../models/Agent.js), [utils/paymentVerification.js](../utils/paymentVerification.js), [utils/salesTarget.js](../utils/salesTarget.js).

Package/built-in imports: `mongoose`.

### services/salesTarget.service.js

[services/salesTarget.service.js](../services/salesTarget.service.js), 1214 lines. SHA-256: `20f5bdaf46a2c5e157930cfc262e61b0e13cb6ee5644fd5f48206bedc1ea3b58`.

Exports: [resolveConfig](../services/salesTarget.service.js#L101), [syncAgents](../services/salesTarget.service.js#L349), [syncAfterSale](../services/salesTarget.service.js#L387), [syncAfterVerification](../services/salesTarget.service.js#L407), [buildView](../services/salesTarget.service.js#L461), [historyRow](../services/salesTarget.service.js#L623), [currentViewFor](../services/salesTarget.service.js#L648), [historyFor](../services/salesTarget.service.js#L655), [startIncentive](../services/salesTarget.service.js#L680), [overview](../services/salesTarget.service.js#L763), [agentDetail](../services/salesTarget.service.js#L842), [readSettings](../services/salesTarget.service.js#L912), [saveSettings](../services/salesTarget.service.js#L1042).

Local imports: [models/Agent.js](../models/Agent.js), [models/SalesTargetConfig.js](../models/SalesTargetConfig.js), [models/AgentSalesPeriod.js](../models/AgentSalesPeriod.js), [models/SalesTargetChange.js](../models/SalesTargetChange.js), [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), [services/notification.service.js](../services/notification.service.js), [services/sales.service.js](../services/sales.service.js), [utils/salesTarget.js](../utils/salesTarget.js).

### services/shiprocket.service.js

[services/shiprocket.service.js](../services/shiprocket.service.js), 14 lines. SHA-256: `18890d577188ba29e5f03e30a90d42366491bdf10ff97858fcc1383a0472ecae`.

Exports: [createShiprocketOrder](../services/shiprocket.service.js#L3).

### services/storeAccess.service.js

[services/storeAccess.service.js](../services/storeAccess.service.js), 21 lines. SHA-256: `c6a4dd6670b39bbcfa6c3f8eb1779e93ea6219866d84c9f443d296ef72ab0ff0`.

Exports: [managerOf](../services/storeAccess.service.js#L3), [assignmentFilter](../services/storeAccess.service.js#L4), [managedStoreFilter](../services/storeAccess.service.js#L10), [findManagedStore](../services/storeAccess.service.js#L11), [managesStore](../services/storeAccess.service.js#L13), [managedConsumerIds](../services/storeAccess.service.js#L15), [mayReadStoreHistory](../services/storeAccess.service.js#L18), [historyConsumerIds](../services/storeAccess.service.js#L20).

Local imports: [models/store.js](../models/store.js).

### services/storeOperation.service.js

[services/storeOperation.service.js](../services/storeOperation.service.js), 50 lines. SHA-256: `beb72c4de8cfe8b14e02a85fdc9181d549e191230b921615802087ed7670f5b9`.

Exports: [withStoreLocks](../services/storeOperation.service.js#L7), [agentStoreCreation](../services/storeOperation.service.js#L21), [storeOperation](../services/storeOperation.service.js#L37).

Local imports: [models/Order.js](../models/Order.js), [models/Return.js](../models/Return.js), [models/Agent.js](../models/Agent.js), [utils/agentAccess.js](../utils/agentAccess.js), [services/payment.service.js](../services/payment.service.js).

### services/target.service.js

[services/target.service.js](../services/target.service.js), 273 lines. SHA-256: `91a405953a7b5c70810ee8b7152f707162658b2058a5b56e5f3118cc41d636da`.

Exports: [settleCompletion](../services/target.service.js#L41), [settleTarget](../services/target.service.js#L64), [updateTargetProgress](../services/target.service.js#L101).

Local imports: [models/Target.js](../models/Target.js), [models/AgentTargetProgress.js](../models/AgentTargetProgress.js), [models/AgentIncentiveLedger.js](../models/AgentIncentiveLedger.js), [utils/targets.js](../utils/targets.js).

### tests/invoice-pdf.test.js

[tests/invoice-pdf.test.js](../tests/invoice-pdf.test.js), 51 lines. SHA-256: `00b7d27c1bda75611d6e6dd839fd1b62cf3dfbeae88169f21229d3e0ca93e16e`.

Exports: none.

Local imports: [utils/generateInvoicePdf.js](../utils/generateInvoicePdf.js).

Package/built-in imports: `node:test`, `node:assert/strict`, `node:fs/promises`, `node:url`, `@napi-rs/canvas`, `pdfjs-dist/legacy/build/pdf.mjs`.

### tests/production-enhancements.test.js

[tests/production-enhancements.test.js](../tests/production-enhancements.test.js), 548 lines. SHA-256: `6c3a8f8fdcfd336619517bd884105686b09609d6f65cf1abecf581ea6167744b`.

Exports: none.

Local imports: [models/Agent.js](../models/Agent.js), [models/store.js](../models/store.js), [models/Order.js](../models/Order.js), [models/Payment.js](../models/Payment.js), [models/Return.js](../models/Return.js), [models/Invoice.js](../models/Invoice.js), [models/AdminAudit.js](../models/AdminAudit.js), [models/Employee.js](../models/Employee.js), [models/Product.js](../models/Product.js), [models/AgentSalesLocation.js](../models/AgentSalesLocation.js), [models/Counter.js](../models/Counter.js), [models/GatewayPayment.js](../models/GatewayPayment.js), [models/Notification.js](../models/Notification.js), [config/razorpay.js](../config/razorpay.js), [services/cashVerification.service.js](../services/cashVerification.service.js), [services/storeOperation.service.js](../services/storeOperation.service.js), [routes/admin.routes.js](../routes/admin.routes.js), [routes/order.routes.js](../routes/order.routes.js), [routes/store.routes.js](../routes/store.routes.js), [routes/return.routes.js](../routes/return.routes.js), [routes/invoice.routes.js](../routes/invoice.routes.js), [routes/agent.routes.js](../routes/agent.routes.js), [controllers/agent.controller.js](../controllers/agent.controller.js), [controllers/auth.controller.js](../controllers/auth.controller.js), [services/payment.service.js](../services/payment.service.js), [services/dashboardSales.service.js](../services/dashboardSales.service.js), [services/sales.service.js](../services/sales.service.js), [services/agentApplication.service.js](../services/agentApplication.service.js), [config/cloudinary.js](../config/cloudinary.js), [services/mediaCleanup.service.js](../services/mediaCleanup.service.js), [controllers/store.controller.js](../controllers/store.controller.js), [utils/pricing.js](../utils/pricing.js).

Package/built-in imports: `node:test`, `node:assert/strict`, `node:crypto`, `mongoose`, `express`, `jsonwebtoken`, `bcryptjs`, `mongodb-memory-server`.

### tests/security-regressions.test.js

[tests/security-regressions.test.js](../tests/security-regressions.test.js), 238 lines. SHA-256: `745d9f666b59bc13a4aaa37ea3161b2ec0a9272f1fd3711805d6b15bdbff7e3a`.

Exports: none.

Local imports: [models/Agent.js](../models/Agent.js), [models/Employee.js](../models/Employee.js), [models/DeliveryPartner.js](../models/DeliveryPartner.js), [models/Product.js](../models/Product.js), [routes/auth.routes.js](../routes/auth.routes.js), [routes/agent.routes.js](../routes/agent.routes.js), [routes/deliveryPartner.routes.js](../routes/deliveryPartner.routes.js), [routes/events.routes.js](../routes/events.routes.js), [middleware/auth.js](../middleware/auth.js), [middleware/upload.js](../middleware/upload.js), [services/liveEvents.js](../services/liveEvents.js), [controllers/order.controller.js](../controllers/order.controller.js), [config/cloudinary.js](../config/cloudinary.js), [utils/cloudinaryStorage.js](../utils/cloudinaryStorage.js), [middleware/loginLimiter.js](../middleware/loginLimiter.js), [controllers/store.controller.js](../controllers/store.controller.js), [controllers/product.controller.js](../controllers/product.controller.js).

Package/built-in imports: `node:test`, `node:assert/strict`, `node:crypto`, `node:stream`, `node:events`, `node:zlib`, `mongoose`, `express`, `jsonwebtoken`, `bcryptjs`, `mongodb-memory-server`.

### utils/agentAccess.js

[utils/agentAccess.js](../utils/agentAccess.js), 9 lines. SHA-256: `9499d6ca1011df53f636206738965778b080aa459c6f0361ceb2d9a6a0a0413e`.

Exports: [ACCESS_STATUSES](../utils/agentAccess.js#L1), [agentMaySignIn](../utils/agentAccess.js#L4), [agentSessionMatches](../utils/agentAccess.js#L7).

### utils/checkConfig.js

[utils/checkConfig.js](../utils/checkConfig.js), 44 lines. SHA-256: `530018667c57de926d894b3b9e32fef0163678966a7b3f66387162b22bfd9a6f`.

Exports: [missingConfig](../utils/checkConfig.js#L32), [reportMissingConfig](../utils/checkConfig.js#L35).

### utils/cloudinaryStorage.js

[utils/cloudinaryStorage.js](../utils/cloudinaryStorage.js), 37 lines. SHA-256: `f95bee4a48a8d09772c26ffd70f4b184d6ecd978dc481a53a30f7261714938c3`.

Exports: [cloudinaryStorage](../utils/cloudinaryStorage.js#L5).

Package/built-in imports: `node:stream`.

### utils/email.js

[utils/email.js](../utils/email.js), 449 lines. SHA-256: `099ff0e46744b4632d65ff320a5c4a2cf5f6dcbf53a7726a56a2740ed5b9692c`.

Exports: [sendAdminNotification](../utils/email.js#L47), [sendAgentApprovalMail](../utils/email.js#L122), [sendAgentRejectionMail](../utils/email.js#L188), [sendEmployeeWelcomeMail](../utils/email.js#L228), [sendDeliveryPartnerApprovalMail](../utils/email.js#L285), [sendDeliveryPartnerRejectionMail](../utils/email.js#L332), [sendPasswordResetMail](../utils/email.js#L384).

Local imports: [utils/frontendUrl.js](../utils/frontendUrl.js).

Package/built-in imports: `resend`.

### utils/formFields.js

[utils/formFields.js](../utils/formFields.js), 47 lines. SHA-256: `43da19019625f53a694fd3a981b9521de241e19539c0fc8d4d85c29aef119839`.

Exports: [checkTextFields](../utils/formFields.js#L16), [PERSON_FIELD_LIMITS](../utils/formFields.js#L30).

### utils/frontendUrl.js

[utils/frontendUrl.js](../utils/frontendUrl.js), 28 lines. SHA-256: `8a532967de2b350ae6dcd70ec27d390d1b14a4d405e0d173cd22ca0aedc56bb6`.

Exports: [LIVE_ORIGINS](../utils/frontendUrl.js#L18), [frontendOrigins](../utils/frontendUrl.js#L21), [frontendBaseUrl](../utils/frontendUrl.js#L27).

### utils/generateInvoicePdf.js

[utils/generateInvoicePdf.js](../utils/generateInvoicePdf.js), 1123 lines. SHA-256: `1fe465112fb29c2245018986036c57297e04eb0441fcaae98599220cc9e68059`.

Exports: [generateInvoicePDFBuffer](../utils/generateInvoicePdf.js#L977).

Package/built-in imports: `pdfkit`, `fs`, `url`.

### utils/geo.js

[utils/geo.js](../utils/geo.js), 99 lines. SHA-256: `9c5ec6aad5c279e48a3dad38370bfacfe364432a47230aac3edcf0f3503acea4`.

Exports: [ACCURACY_ALLOWANCE_MAX_M](../utils/geo.js#L12), [distanceInMetres](../utils/geo.js#L15), [toPoint](../utils/geo.js#L35), [readLocation](../utils/geo.js#L50), [checkAtStore](../utils/geo.js#L74), [formatDistance](../utils/geo.js#L97).

### utils/invoiceNumber.js

[utils/invoiceNumber.js](../utils/invoiceNumber.js), 33 lines. SHA-256: `1c3c3706dd6e1653fb1166427c9e68ca5a08447232ca74bee5cb949eaedd49d9`.

Exports: [generateInvoiceNumber](../utils/invoiceNumber.js#L16), [invoiceFileName](../utils/invoiceNumber.js#L31).

Local imports: [models/Counter.js](../models/Counter.js).

### utils/otp.js

[utils/otp.js](../utils/otp.js), 12 lines. SHA-256: `c726a4f3437026d45b24e76ab196f5553f53c78ad10b7650c27d18b4808e3322`.

Exports: [generateOTP](../utils/otp.js#L6), [sendOtpSMS](../utils/otp.js#L9).

Package/built-in imports: `crypto`.

### utils/paymentVerification.js

[utils/paymentVerification.js](../utils/paymentVerification.js), 88 lines. SHA-256: `9cea813780ad87601de462b499e3110aa91322a5eeebe2566a2ccdd2cf4ad494`.

Exports: [PENDING](../utils/paymentVerification.js#L23), [APPROVED](../utils/paymentVerification.js#L24), [REJECTED](../utils/paymentVerification.js#L25), [VERIFICATION_STATUSES](../utils/paymentVerification.js#L27), [needsVerification](../utils/paymentVerification.js#L32), [pendingVerification](../utils/paymentVerification.js#L35), [COUNTS_AS_COLLECTED](../utils/paymentVerification.js#L48), [COUNTED_ON](../utils/paymentVerification.js#L54), [countedAtFor](../utils/paymentVerification.js#L67), [monthStartOf](../utils/paymentVerification.js#L82).

### utils/pricing.js

[utils/pricing.js](../utils/pricing.js), 83 lines. SHA-256: `64fac87e930002032a7f5afa1dc678f149aa6fd769afd592333ebebfc5efc03d`.

Exports: [TIER_FIELDS](../utils/pricing.js#L16), [STORE_TYPES](../utils/pricing.js#L23), [getLocationOverrides](../utils/pricing.js#L31), [applyLocationPrices](../utils/pricing.js#L53), [effectivePrice](../utils/pricing.js#L70).

Local imports: [models/AgentSalesLocation.js](../models/AgentSalesLocation.js), [utils/salesLocation.js](../utils/salesLocation.js).

### utils/publicError.js

[utils/publicError.js](../utils/publicError.js), 38 lines. SHA-256: `29a1a9c632bc3cfe0cec749c40f64b2d128456666a4c5f56a0a2f3a04299dd73`.

Exports: [publicMessage](../utils/publicError.js#L19).

### utils/salesLocation.js

[utils/salesLocation.js](../utils/salesLocation.js), 16 lines. SHA-256: `dc5de220f9d61c56a029722017c0fceae2d2777283e5ff2e89eee03d185927ea`.

Exports: [normalizeSalesState](../utils/salesLocation.js#L4), [normalizePincode](../utils/salesLocation.js#L11), [coverageForState](../utils/salesLocation.js#L13).

### utils/salesTarget.js

[utils/salesTarget.js](../utils/salesTarget.js), 413 lines. SHA-256: `10e611d8a0b02fd63db4995b7e4411924b9007a8ea449e553972351b30a569b0`.

Exports: [isMonthKey](../utils/salesTarget.js#L36), [isDateKey](../utils/salesTarget.js#L40), [dateKeyOf](../utils/salesTarget.js#L54), [monthKeyOf](../utils/salesTarget.js#L60), [monthLabel](../utils/salesTarget.js#L63), [addMonths](../utils/salesTarget.js#L69), [dayRange](../utils/salesTarget.js#L76), [monthRange](../utils/salesTarget.js#L83), [monthDates](../utils/salesTarget.js#L92), [workingDatesOf](../utils/salesTarget.js#L106), [weeksOf](../utils/salesTarget.js#L120), [buildBreakdown](../utils/salesTarget.js#L155), [percentOf](../utils/salesTarget.js#L211), [buildDynamic](../utils/salesTarget.js#L250).

### utils/sanitizeHtml.js

[utils/sanitizeHtml.js](../utils/sanitizeHtml.js), 97 lines. SHA-256: `519401fb4b884177a49339a3c41ec4fa0f09bf015b8fbef7a0cade4fdf730942`.

Exports: [sanitizeDescription](../utils/sanitizeHtml.js#L62).

### utils/seedFaqs.js

[utils/seedFaqs.js](../utils/seedFaqs.js), 142 lines. SHA-256: `3a05de8f8a620cbab517f92714b9d7f7f11ccfe21d280b0a06cf92dd5fdb0fd6`.

Exports: [seedFAQs](../utils/seedFaqs.js#L3).

Local imports: [models/FAQ.js](../models/FAQ.js).

### utils/targets.js

[utils/targets.js](../utils/targets.js), 86 lines. SHA-256: `3ef9a9332c1bbfa3628b74a853fe1e169da6ef12fbdc54b6671caa664c13798b`.

Exports: [TARGET_TYPES](../utils/targets.js#L8), [PERIODS](../utils/targets.js#L12), [ORDER_METRICS](../utils/targets.js#L17), [normalizePeriod](../utils/targets.js#L26), [normalizeOrderMetric](../utils/targets.js#L34), [windowEnd](../utils/targets.js#L49), [isForEveryone](../utils/targets.js#L72), [appliesToAgent](../utils/targets.js#L80).

### utils/uom.js

[utils/uom.js](../utils/uom.js), 30 lines. SHA-256: `4ba0314e8817107ea5e79d58874408492aef8b4478a763593cdd163062669e42`.

Exports: [UNITS](../utils/uom.js#L13), [normalizeUnit](../utils/uom.js#L16), [isKnownUnit](../utils/uom.js#L19), [quantityWithUnit](../utils/uom.js#L25).

### utils/uploadPdf.js

[utils/uploadPdf.js](../utils/uploadPdf.js), 84 lines. SHA-256: `ea3ea7df95b4bd21d9f591caa10b8c1783b8c40abb126a2186c17e5995aa7a61`.

Exports: [invoicePublicId](../utils/uploadPdf.js#L35), [isGuessableInvoiceUrl](../utils/uploadPdf.js#L43), [removeGuessableInvoiceFile](../utils/uploadPdf.js#L49), [uploadPdfToCloudinary](../utils/uploadPdf.js#L66).

Local imports: [config/cloudinary.js](../config/cloudinary.js), [utils/invoiceNumber.js](../utils/invoiceNumber.js).

Package/built-in imports: `crypto`, `streamifier`.
