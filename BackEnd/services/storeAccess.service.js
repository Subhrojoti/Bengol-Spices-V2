import Store from "../models/store.js";

export const managerOf = (store) => store?.currentAgentId || store?.registeredBy;
export const assignmentFilter = (agentId) => ({
  $or: [
    { currentAgentId: agentId },
    { currentAgentId: { $in: [null, ""] }, registeredBy: agentId },
  ],
});
export const managedStoreFilter = (agentId) => ({ status: "ACTIVE", ...assignmentFilter(agentId) });
export const findManagedStore = (consumerId, agentId) =>
  Store.findOne({ consumerId, ...managedStoreFilter(agentId) });
export const managesStore = async (consumerId, agentId) =>
  Boolean(await Store.exists({ consumerId, ...managedStoreFilter(agentId) }));
export const managedConsumerIds = (agentId) => Store.distinct("consumerId", managedStoreFilter(agentId));

// Archived history stays readable by its last manager; operational APIs require ACTIVE.
export const mayReadStoreHistory = async (consumerId, agentId) =>
  Boolean(await Store.exists({ consumerId, ...assignmentFilter(agentId) }));
export const historyConsumerIds = (agentId) => Store.distinct("consumerId", assignmentFilter(agentId));
