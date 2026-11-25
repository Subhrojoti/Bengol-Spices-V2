# Store management, Chain products and delivery planning

Implemented locally on 23 November 2026. Existing order, invoice and payment
records require no conversion.

## Admin and authorised employees

- In **Agent → Manage agents & stores → Stores**, **Delete test store**
  opens the existing preview directly. It requires all linked orders to be
  cancelled, the typed store ID and test-data confirmation. The preview
  protects gateway records, open returns and shared accounting history.
  Archive is available for stores that need their business history retained.
- For archived stores, **Unarchive / manage** opens restoration. Confirm
  with the store ID. The current responsible agent must be approved and active.
  The store, original creator, current assignment and linked records remain
  intact. A photo removed during archive stays removed. The API records a
  `RESTORE_STORE` audit entry within the restoration transaction and uses
  the existing `canManageAgents` permission and signed preview.
- Under **Product Creation → Classification**, select **Chain** and enter
  **Packets per chain**. In **Pricing & Inventory**, **Enter prices per**
  sets the basis for the base, discount and store-tier prices. Stock and
  minimum order quantities are always entered as whole chains. Packaging
  changes require a new SKU so prior stock and order quantities remain
  interpretable. All Products supports editing the pricing basis and prices
  of a Chain SKU.

## Agent mobile

### Category price comparison (25 November 2026, local)

Open a store, choose Create order / Add Products, and tap **View all category
prices & minimums** on a product. Product details display the four category
prices and minimum quantities, highlighting the current store category.
The managed-store API adds `minimumOrderQuantities` computed from the original
product floor for each category. The existing `minOrderQty` remains the current
store minimum, preserving older clients and checkout validation. Comparison
prices use the same territory overrides and fallback prices as checkout;
Chain minimums remain in chains even when prices are quoted per packet.
The view does not let the agent switch the store category or alter prices.
An older API cannot provide other categories' effective minimums, so those
values display as unavailable until the backend update is deployed.

Validation: Agent TypeScript check; three component regressions covering all
categories, old API compatibility, Chain quotes and unchanged selected-store
Add behavior; two isolated backend regressions covering effective minimums,
store ownership, Chain conversion and stock reservation. No production data
was changed. Native visual checks were not performed for this addition.

Product picker, product detail, cart and draft editing show configured rates.
For 12 packets at ₹4.25 each, the charge is ₹51 per chain, so ordering two
chains reserves two and charges ₹102. The API keeps canonical per-chain unit
prices for catalogue, stock, minimums, orders and invoices. Existing location
price overrides are per selling unit, which means per chain for a Chain SKU.
A fractional per-packet equivalent of a location price is labelled approximate.
Checkout validates whole chains before reserving stock or starting payment
when that client supplies its cart. Order lines snapshot SKU and pack size.

## Delivery mobile

- **Deliveries → All agents** filters the logged-in partner's active orders
  by one or more sales agents. Rows show the order placement date. The API
  exposes agent names and variant identifiers only for orders assigned to
  that partner, using `GET /delivery-partner/orders?view=mobile-planning`.
  The original delivery response stays available.
- **Delivery quantities** adds up the filtered orders by SKU and unit.
  Quantities already reserved for return are excluded. Chain variants show
  both the number of chains and their equivalent packet count.
- In an **Out for delivery** order, use **Return entire order** when taking
  back all remaining goods. It uses the same return request and retry
  reference as **Return Specific Items**. A fully returned order remains
  visible as awaiting office review and cannot be marked delivered. Existing
  warehouse receipt and financial review still apply. Recording a return
  leaves invoices, payments, balances and stock as recorded.

## Rollout

Deploy the backend and Admin together, then release new signed Agent and
Delivery builds. The backend accepts existing clients and keeps per-chain sales
values in the existing price fields. Existing mobile builds can use the
selling unit but need the update for the new quote and planning interfaces.

## Verification

The isolated backend suite passed 128 tests. The mobile suites passed 75
tests, and 27 focused Admin browser tests passed. Admin lint and SPA build,
both mobile type checks and both Android Hermes exports passed. The browser checks exercised
the new Chain form and archived-store confirmation. Backend tests exercised
canonical pricing and stock, permission and restoration checks, a partial
return followed by a whole refusal, and blocked delivery confirmation once no
goods remain. The concurrent browser and backend run reproduced intermittent
store-lock timing failures in two existing payment tests. The isolated
backend run passed both tests.

### Physical Android verification

The Agent and Delivery flows passed on a Motorola Edge 70 Fusion in Expo
Go for SDK 56, with the local backend connected to a disposable MongoDB
replica set. The Agent displayed both price bases and submitted two
12-packet chains at ₹4.25 per packet. The saved order total and due were
both ₹102, stock fell by two chains, and a zero advance created no payment.

Delivery showed only the signed-in partner's assigned orders and their
placement dates. Selecting two agents produced five 12-packet chains and
one 24-packet chain. Returning both lines of one order created a picked-up
return for office review and removed its delivery confirmation action.
The remaining load refreshed to three 12-packet chains. The return left
the ₹198 due balance and stock unchanged and created no payment. These
checks used synthetic records and did not exercise a signed release build.
