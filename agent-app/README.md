# Bengol Spices — Agent App

Full rebuild incorporating every fix and feature from our conversation,
including the new QR payment method.

## Setup

```
npm install
cp .env.example .env
```
Edit `.env` with your computer's LAN IP + backend port.

```
npx expo start
```
Scan with Expo Go.

## What's new in this build

- **QR payments** — a third payment option (alongside Cash and Online) on
  both Create Order and Collect Payment. The agent generates a Razorpay
  Dynamic QR code, the store owner scans and pays via their own UPI app,
  and the app polls automatically until Razorpay confirms payment — no
  manual "mark as paid" step. Collect Payment's QR flow always uses the
  order's full due amount (no partial QR payments), per your requirement.
  **Requires the backend QR endpoints to be in place** — see the
  `qr-payment-controller.js` / routes we built together.
- **Keyboard fix, strengthened** — `KeyboardAvoidingView` now uses
  `"height"` behavior on Android (was `undefined`), plus a
  `keyboardVerticalOffset`, plus generous scroll padding on every form
  screen as a reliable fallback. `app.json` also sets
  `softwareKeyboardLayoutMode: "resize"`, though note that setting only
  takes effect in a custom build (EAS Build), not in plain Expo Go.
- **Premium dashboard card** — shadow, subtle gold border, glossy sheen
  overlay, more generous internal spacing.
- **Stat card spacing** — more breathing room, same fonts as before.
- Every other fix from our conversation is included: the `IconButton`
  background bug, real error messages across every screen, pull-to-refresh
  on Order Detail, the Expo Router crash fix, the self-registration flow,
  store type filtering, and more.

## Before you test QR payments

Make sure you've added the backend QR endpoints (5 routes under
`/agent/orders/razorpay/`) and the `"QR"` value to the `Order` model's
`paymentMode` enum — this app assumes those are already in place.
