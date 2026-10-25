export const ACCESS_STATUSES = ["ACTIVE", "BLOCKED", "DEACTIVATED", "DELETED"];

// Missing fields are legacy active accounts. Approval is still independently required.
export const agentMaySignIn = (agent) =>
  agent?.status === "APPROVED" && (agent.accessStatus || "ACTIVE") === "ACTIVE";

export const agentSessionMatches = (agent, token) =>
  agentMaySignIn(agent) && (agent.sessionVersion || 0) === (token.sessionVersion || 0);
