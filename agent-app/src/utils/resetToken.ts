/**
 * The approval and password-reset emails link to the web frontend, e.g.
 *   https://…/agent-reset-password?token=abc123
 *
 * Agents using the app can paste either that whole link or just the token.
 * This pulls the token out of a pasted link and leaves a raw token untouched,
 * so both forms work on the Set Password and Reset Password screens.
 */
export function extractToken(input: string): string {
  const value = input.trim();
  const match = value.match(/[?&]token=([^&#\s]+)/i);
  if (!match) return value;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
