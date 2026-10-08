# Bengol Spices — Delivery Partner App

A React Native (Expo) mobile app for Bengol Spices delivery partners —
assigned deliveries, status updates, return pickups, and dashboard stats.
Built with the same stack and design system as the Agent app, sharing the
same backend.

If you already set up the Agent app, this will feel very familiar — same
steps, same gotchas. If this is your first app, see the Agent app's README
for a fuller step-by-step walkthrough (installing Node, Expo Go, etc.);
this one focuses on what's specific to this app.

---

## 1. Install

```
cd delivery-app
npm install
```

## 2. Connect to your backend

```
cp .env.example .env
```
Edit `.env` and set `EXPO_PUBLIC_API_URL` to your computer's LAN IP + your
backend's port (run `ipconfig` on Windows / `ifconfig`/`hostname -I` on
Mac/Linux to find your IP — NOT `localhost`, that won't work on a physical
phone).

## 3. Run

```
npx expo start
```
Scan the QR code with Expo Go (same app you already installed for the
Agent app — one Expo Go app can run any Expo project).

## 4. Try it out

Log in with a real **ACTIVE** delivery partner's phone number and password
(a delivery partner admin has already approved — status must be `ACTIVE`).
Or tap "Apply Now" to submit a new registration and approve it from your
admin panel first.

**The core workflow**, per your spec: once an order is assigned to a
delivery partner, they move it through status changes manually — Assigned
→ Shipped → Out for Delivery → Delivered — each via a single button tap
on the Delivery Detail screen. No OTP step, as agreed.

**Password reset.** "Forgot password?" on the login screen asks for the
registered phone number and calls `POST /auth/delivery-partner/forgot-password`.
The backend emails a link of the form
`<FRONTEND_URL>/delivery-reset-password?token=…` (valid 15 minutes, one
resend per minute). The app handles that path, so the token is picked up
automatically when the link opens the app. If the link opens in a browser
instead (no universal/app links configured for `FRONTEND_URL`), the partner
copies the link from the email and pastes it on the Reset Password screen.
To test the deep link on a dev build or Expo Go:

```bash
npx uri-scheme open "bengoldelivery:///delivery-reset-password?token=<token-from-email>" --android
```

---

## What's built

| Area | Screens |
|---|---|
| Auth | Login, Apply (self-registration with ID document upload), Forgot password (emailed link), Reset password |
| Dashboard | Delivered/returns/pending-pickup summary, monthly trend chart, yearly comparison |
| Deliveries | Assigned orders list, detail screen with status-update button, "Navigate to Store" (opens your phone's own Maps app) |
| Returns | Assigned pickups list, detail screen with status-update button, refund status |
| Other | Notifications, Help/FAQ, Profile |

**Not built, on purpose:** Change Password. Your backend's
`changePassword` endpoint is hardcoded to look up an Agent record — it
doesn't work for a delivery partner's own account. Rather than ship a
button that silently fails, I left it out. Let me know if you want that
backend gap fixed and I'll add both the fix and the screen.

**Also not built:** OTP verification on the "Delivered" step — per your
instruction, this is a simple, direct status-change button, matching
exactly what your backend currently supports.

---

## Design

Same brand palette, fonts, and component patterns as the Agent app — see
that app's README for the full breakdown. The logo used here
(`assets/images/logo.png`) is the same transparent-background version
already prepared for the Agent app.

## Troubleshooting

Same as the Agent app — see that README's troubleshooting section
(network/IP issues, SDK version mismatches with Expo Go, etc.). Nothing
here works meaningfully differently.
