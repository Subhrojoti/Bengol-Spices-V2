/**
 * A reference for one request, made up on the phone and sent with it. If the
 * reply is lost and the request is sent again with the same reference, the
 * server answers with what it already did instead of doing it twice.
 *
 * It only has to be different from this agent's other references, not
 * secret, so the time and two random pieces are enough.
 */
export function newRequestId(): string {
  const piece = () => Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  return `${Date.now().toString(36)}-${piece()}${piece()}`;
}
