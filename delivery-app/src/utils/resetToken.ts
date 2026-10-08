/**
 * Pulls the reset token out of whatever the user pasted: the full link from
 * the email (`https://…/delivery-reset-password?token=abc…`) or the bare token.
 * Returns null when nothing token-shaped is found.
 */
export function extractResetToken(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const fromQuery = raw.match(/[?&#]token=([^&#\s]+)/);
  let candidate = fromQuery ? fromQuery[1] : raw;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Not URL-encoded; use as-is.
  }

  return /^[A-Za-z0-9._~-]{16,}$/.test(candidate) ? candidate : null;
}
