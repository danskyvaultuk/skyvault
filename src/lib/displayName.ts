// The name a customer is called by (BL-081 / SPEC-030 B2): trimmed, 1 to 60 characters.
import { z } from "zod";

export const DISPLAY_NAME_MAX = 60;

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter the name we should call you.")
  .max(DISPLAY_NAME_MAX, `Please use ${DISPLAY_NAME_MAX} characters or fewer.`);
