export type DefectSeverity = "low" | "medium" | "high" | "critical";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface DefectItem {
  type:
    | "missing_tiles"
    | "cracked_tiles"
    | "moss_growth"
    | "flashing_damage"
    | "gutter_damage"
    | "ridge_damage"
    | "valley_damage"
    | "other";
  severity: DefectSeverity;
  description: string;
  image_index: number;
}

export interface RoofAnalysis {
  condition_score: number;
  defects: DefectItem[];
  estimated_remaining_life_years: number | null;
  recommendations: string[];
  urgent_action_required: boolean;
  confidence: ConfidenceLevel;
  surveyor_notes: string;
}

export interface LeadSummary {
  postcode: string;
  conditionScore: number;
  defectTypes: string[];
  propertyType: string;
  reportUrl: string;
}
