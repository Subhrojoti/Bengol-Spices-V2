// State is free text in already-installed agent apps. Normalize presentation
// differences and the observed West Bengal typo; never use fuzzy matching or
// another agent's coverage to grant permission.
export const normalizeSalesState = (value) => {
  const state = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  const compact = state.replace(/[\s.]/g, "");
  if (["WESTBENGAL", "WESTBANGAL", "WB"].includes(compact)) return "WEST BENGAL";
  return state;
};

export const normalizePincode = (value) => String(value ?? "").trim();

export const coverageForState = (locations, state) => locations.filter(
  (location) => normalizeSalesState(location.state) === normalizeSalesState(state),
);
