// The Add property address step (BL-074 / SPEC-022 Part B): postcode first,
// pick from the addresses found, or enter the address by hand. Pure state, so
// the page holds no logic of its own.
import { z } from "zod";
import type { FoundAddress } from "@/lib/idealPostcodes";

export type AddressFields = { address: string; town: string; postcode: string };

export type AddressFinderState = {
  postcode: string;
  searching: boolean;
  addresses: FoundAddress[];
  message: string;
  showFields: boolean;
  fields: AddressFields;
};

export type AddressFinderAction =
  | { type: "postcode-typed"; value: string }
  | { type: "search-started" }
  | { type: "found"; addresses: FoundAddress[] }
  | { type: "refused"; message: string }
  | { type: "chosen"; index: number }
  | { type: "enter-by-hand" }
  | { type: "field-edited"; field: keyof AddressFields; value: string };

export const initialAddressFinder: AddressFinderState = {
  postcode: "",
  searching: false,
  addresses: [],
  message: "",
  showFields: false,
  fields: { address: "", town: "", postcode: "" },
};

function withFieldsShown(state: AddressFinderState): AddressFinderState {
  const postcode = state.fields.postcode || state.postcode.trim().toUpperCase();
  return { ...state, showFields: true, fields: { ...state.fields, postcode } };
}

export function addressFinderReducer(state: AddressFinderState, action: AddressFinderAction): AddressFinderState {
  switch (action.type) {
    case "postcode-typed":
      return { ...state, postcode: action.value.toUpperCase() };
    case "search-started":
      return { ...state, searching: true, addresses: [], message: "" };
    case "found":
      return { ...state, searching: false, addresses: action.addresses };
    case "refused":
      return withFieldsShown({ ...state, searching: false, addresses: [], message: action.message });
    case "chosen": {
      const picked = state.addresses[action.index];
      return picked ? { ...state, showFields: true, fields: { ...picked } } : state;
    }
    case "enter-by-hand":
      return withFieldsShown(state);
    case "field-edited":
      return { ...state, fields: { ...state.fields, [action.field]: action.value } };
  }
}

const FALLBACK = "Address search isn't working right now. Please enter your address by hand.";

const LookupReply = z.object({
  addresses: z.array(z.object({ address: z.string(), town: z.string(), postcode: z.string() })).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/** What the address lookup route's answer means for the address step. */
export function actionForLookupReply(status: number, body: unknown): AddressFinderAction {
  const parsed = LookupReply.safeParse(body);
  if (!parsed.success) return { type: "refused", message: FALLBACK };
  const { addresses, message, error } = parsed.data;
  if (status === 200 && addresses && addresses.length > 0) return { type: "found", addresses };
  return { type: "refused", message: error ?? message ?? FALLBACK };
}
