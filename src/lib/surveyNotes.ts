// Survey notes: a customer's free text, stored and sent (in part) to the AI.
// Bounded on create and update (BL-066 / SPEC-021 C4).
import { z } from "zod";

export const MAX_SURVEY_NOTES = 2000;

export const SurveyNotesSchema = z.string().max(MAX_SURVEY_NOTES);
