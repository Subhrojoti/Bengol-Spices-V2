export interface CoverageLocation { state: string; city?: string; pincodes: string[] }
export interface CoverageChoice { state: string; cities: string[]; pincodes: string[] }

export function coverageState(value: string): string {
  const state = value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  return ["WB", "WESTBANGAL", "WESTBENGAL"].includes(state.replace(/[\s.]/g, "")) ? "WEST BENGAL" : state;
}

/** Suggestions come from assigned coverage, not a guessed GPS/postal lookup. */
export function coverageChoices(locations: CoverageLocation[]): CoverageChoice[] {
  const groups = new Map<string, { cities: Map<string, string>; pincodes: Set<string> }>();
  for (const location of locations) {
    if (!location || typeof location.state !== "string") continue;
    const state = coverageState(location.state);
    if (!state || !Array.isArray(location.pincodes)) continue;
    const pins = location.pincodes.map(pin => String(pin).trim()).filter(pin => /^[0-9]{6}$/.test(pin));
    if (!pins.length) continue;
    let group = groups.get(state);
    if (!group) { group = { cities: new Map(), pincodes: new Set() }; groups.set(state, group); }
    pins.forEach(pin => group.pincodes.add(pin));
    const city = typeof location.city === "string" ? location.city.trim().replace(/\s+/g, " ") : "";
    if (city && !group.cities.has(city.toUpperCase())) group.cities.set(city.toUpperCase(), city);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([state, group]) => ({
    state, cities: [...group.cities.values()].sort((a, b) => a.localeCompare(b)), pincodes: [...group.pincodes].sort(),
  }));
}

export function addressDefaults(area?: CoverageChoice) {
  return { city: area?.cities.length === 1 ? area.cities[0] : "", pincode: area?.pincodes.length === 1 ? area.pincodes[0] : "" };
}
