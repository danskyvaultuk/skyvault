// Peripheral zones (BL-004 / SPEC-013): the edges and joins generic roof AI
// tends to miss. The AI is told to inspect each one by name and tags every
// defect with its zone ("none" when it is not in one). Imports nothing, so the
// admin review form can use the list.

export const DEFECT_ZONES = [
  "eaves", "wall_junction", "fascia", "upstand", "drainage_point", "protrusion", "none",
] as const;

export type DefectZone = (typeof DEFECT_ZONES)[number];

export const ZONE_LABELS: Record<Exclude<DefectZone, "none">, string> = {
  eaves: "Eaves",
  wall_junction: "Wall junction",
  fascia: "Fascia",
  upstand: "Upstand",
  drainage_point: "Drainage point",
  protrusion: "Protruding material",
};

export function peripheralPromptSection(): string {
  return `Peripheral zones — these are easy to overlook, so inspect each one visible in the photos by name:
- eaves lines (the lower edge of each slope),
- wall junctions (where the roof meets a wall, abutment or neighbouring property),
- fascia (the board along the eaves),
- upstands (flashing and edges turned up against walls, chimneys or skylights),
- drainage points (gutters, outlets, downpipe heads, valleys draining into them),
- protruding materials (vents, pipes, aerials, chimneys and anything fixed through the covering).
For every defect set "zone" to the zone it is in ("eaves", "wall_junction", "fascia", "upstand", "drainage_point",
"protrusion"), or "none" when it is not in one. Use the existing defect types; a zone never needs a new type.`;
}
