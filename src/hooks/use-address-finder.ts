"use client";

// Drives the Add property address step (BL-074 / SPEC-022 Part B) against
// SkyVault's own lookup route; the state rules live in src/lib/addressFinder.ts.
import { useCallback, useReducer } from "react";
import { actionForLookupReply, addressFinderReducer, initialAddressFinder, type AddressFields } from "@/lib/addressFinder";

export function useAddressFinder() {
  const [state, dispatch] = useReducer(addressFinderReducer, initialAddressFinder);

  const search = useCallback(async () => {
    dispatch({ type: "search-started" });
    try {
      const res = await fetch(`/api/address-lookup?postcode=${encodeURIComponent(state.postcode)}`);
      const body: unknown = await res.json().catch(() => null);
      dispatch(actionForLookupReply(res.status, body));
    } catch {
      dispatch(actionForLookupReply(0, null));
    }
  }, [state.postcode]);

  return {
    state,
    search,
    typePostcode: (value: string) => dispatch({ type: "postcode-typed", value }),
    choose: (index: number) => dispatch({ type: "chosen", index }),
    enterByHand: () => dispatch({ type: "enter-by-hand" }),
    editField: (field: keyof AddressFields, value: string) => dispatch({ type: "field-edited", field, value }),
  };
}
