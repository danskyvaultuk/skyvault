import { describe, expect, it } from "vitest";
import { addressFinderReducer, initialAddressFinder, actionForLookupReply, type AddressFinderState } from "./addressFinder";

const LISTED: AddressFinderState = {
  ...initialAddressFinder,
  postcode: "TQ9 5QH",
  addresses: [
    { address: "10 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
    { address: "12 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
  ],
};

describe("addressFinderReducer (BL-074 / SPEC-022 Part B)", () => {
  it("starts with only the postcode step: no list, no fields", () => {
    expect(initialAddressFinder.addresses).toEqual([]);
    expect(initialAddressFinder.showFields).toBe(false);
  });

  it("clears the old list and message when a search starts", () => {
    const state = addressFinderReducer({ ...LISTED, message: "old" }, { type: "search-started" });
    expect(state.searching).toBe(true);
    expect(state.addresses).toEqual([]);
    expect(state.message).toBe("");
  });

  it("B1: lists the addresses found", () => {
    const state = addressFinderReducer(
      { ...initialAddressFinder, searching: true },
      { type: "found", addresses: LISTED.addresses }
    );
    expect(state.searching).toBe(false);
    expect(state.addresses).toHaveLength(2);
  });

  it("B1: choosing an address fills in the street address, town and postcode, and shows them for editing", () => {
    const state = addressFinderReducer(LISTED, { type: "chosen", index: 1 });
    expect(state.fields).toEqual({ address: "12 High Street", town: "TOTNES", postcode: "TQ9 5QH" });
    expect(state.showFields).toBe(true);
  });

  it("ignores a choice that is not in the list", () => {
    expect(addressFinderReducer(LISTED, { type: "chosen", index: 9 })).toBe(LISTED);
  });

  it("B2: 'My address isn't listed' shows the fields, carrying the postcode typed", () => {
    const state = addressFinderReducer(LISTED, { type: "enter-by-hand" });
    expect(state.showFields).toBe(true);
    expect(state.fields.postcode).toBe("TQ9 5QH");
  });

  it("B2: the fields stay editable after an address is chosen", () => {
    const chosen = addressFinderReducer(LISTED, { type: "chosen", index: 0 });
    const edited = addressFinderReducer(chosen, { type: "field-edited", field: "address", value: "Flat 1, 10 High Street" });
    expect(edited.fields.address).toBe("Flat 1, 10 High Street");
    expect(edited.fields.town).toBe("TOTNES");
  });

  it("B3: a refused lookup shows its message and offers the fields by hand", () => {
    const state = addressFinderReducer(
      { ...initialAddressFinder, searching: true },
      { type: "refused", message: "Please try again tomorrow." }
    );
    expect(state.message).toBe("Please try again tomorrow.");
    expect(state.searching).toBe(false);
    expect(state.showFields).toBe(true);
  });
});

describe("actionForLookupReply (BL-074 / SPEC-022 B3)", () => {
  it("turns a list into found", () => {
    expect(actionForLookupReply(200, { addresses: LISTED.addresses })).toEqual({ type: "found", addresses: LISTED.addresses });
  });

  it("turns an empty list into a refusal carrying the route's message", () => {
    expect(actionForLookupReply(200, { addresses: [], message: "No addresses." })).toEqual({ type: "refused", message: "No addresses." });
  });

  it.each([400, 429, 503])("turns a %i into a refusal carrying the route's error", (status) => {
    expect(actionForLookupReply(status, { error: "Plain words." })).toEqual({ type: "refused", message: "Plain words." });
  });

  it("falls back to a plain message for an unreadable reply", () => {
    const action = actionForLookupReply(500, "nonsense");
    expect(action.type).toBe("refused");
    expect(action.type === "refused" && action.message).toMatch(/enter your address by hand/i);
  });
});
