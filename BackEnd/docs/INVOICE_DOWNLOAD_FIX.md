# Invoice download and PDF review - 27 October 2026

Status: implemented and validated locally; production rollout is pending.

## Report and diagnosis

The owner reported an Employee invoice download displaying "No invoice is
available yet" for `ORD2026-0017`. Read-only inspection found both its Invoice
record and stored PDF. The order/invoice amounts agree: total 182.00, paid 1.00,
due 181.00; four gross line amounts sum to 182.00. Stored line tax sums to 8.66,
leaving taxable value 173.34, with CGST 4.33 and SGST 4.33.

The authenticated API previously returned a redirect to external PDF storage.
The stored file itself returned HTTP 200, but its CORS headers allowed wildcard
origins without credentials. The shared browser HTTP client sends credentials;
a normal production Admin sign-in reproduced a browser TypeError on download.
This is distinct from a missing invoice or an Employee permission failure.
Reference: [MDN credentialed CORS guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSNotSupportingCredentials).

The stored PDF also predates the supplied invoice logo and labels the order's
packets as pcs. Its financial totals match the records; branding/unit labels
were stale. No HSN codes are stored for these products. The owner explicitly
said to leave those unavailable for now; no codes or tax classifications were
invented. This review verifies rendering and arithmetic against saved records,
not statutory tax classification or legal compliance.

## Implemented behavior

- `GET /api/invoice/download/:orderId` returns HTTP 200 PDF bytes with attachment,
  no-store and nosniff headers from the API, instead of a storage redirect.
- The saved Invoice supplies financial values. The current template supplies
  the existing invoice-logo asset, avoiding stale stored PDFs. Ordinary downloads
  with an existing non-guessable file URL do not rewrite invoices or payments.
- Existing missing-invoice recovery and legacy guessable-file migration remain.
  If storage upload fails for an existing invoice, local rendering still serves
  its PDF. The download does not fetch arbitrary stored URLs on the server.
- Existing backend ownership/permission checks remain: Admin, permitted Employee,
  managing agent and assigned delivery partner only. Other users still receive
  404; unauthenticated callers receive 401.
- Quantity/per-unit labels use saved order units when the corresponding invoice
  line matches by index, name and quantity. Legacy lines without units retain pcs.
  Mixed units are not added together as pcs. Net unit rates retain up to six
  decimal places; line amounts and totals remain unchanged.
- Shared Admin/Employee Orders now displays a retry/connection message for a
  network failure rather than asserting that an invoice does not exist. Server
  JSON errors are still displayed. Employee diagnostics use the existing secret-
  filtering error reporter. No agent/delivery frontend or mobile code changed.

## Validation and limits

- All 49 backend tests pass, including five isolated download/authentication
  tests, external-storage failure injection, and three PDF rendering tests.
- Packet example: 40 packets, taxable 173.34, CGST 4.33, SGST 4.33, total 182.00.
  Packet and three-page (65-line) PDF renderings were inspected for logo,
  alignment, table continuation, unit labels, totals and footer layout.
- Admin/shared lint and full production build/prerender pass. The existing
  shared-entry bundle-size warning remains. All nine frontend unit tests pass.
- All 76 Chrome Admin/Employee browser cases pass against an isolated production
  build, including successful Employee PDF download and network-failure retry.
  The existing order, cash verification, incentives, targets, reporting and
  permission workflows pass. Unrelated Product Sales/mobile edits were excluded.
- Tests use isolated MongoDB/synthetic accounts and intercepted browser APIs;
  they never load live backend environment files. Production Employee login was
  not exercised with an employee's password. No production employee tokens were
  minted, and no business records were modified by diagnostics.
- Normal Admin browser login reproduced the deployed failure. Production success
  must be checked after rollout; a local test pass does not establish live state.

## Rollout and recovery

Deploy only this backend and shared Admin/Employee website fix through the existing
backend backup/health/rollback and staged frontend swap procedures. Preserve
unrelated Product Sales and mobile edits. No database migration, account reset,
tax-code backfill or bulk PDF rewrite is required. Backend rollback restores the
redirect behavior and may reintroduce the browser download failure.

Release candidate: `FrontEnd/.admin-audit.local/invoice-release/src/`, built from
HEAD `ca2f1a97d4a6e1b2538bb9587692703403acfc81` plus only the eight invoice runtime/test
files. The candidate is ignored/local, not an off-machine backup. Persistent
source, tests and these notes remain in the working tree; this fix has not been
committed, pushed or deployed. Rebuild from a scoped commit before rollout.

A synthetic PDF with the reported quantities/amounts (no real customer details)
is saved at `output/pdf/invoice-layout-preview.pdf` for visual review. It is a
preview, not a replacement for the customer's invoice.
