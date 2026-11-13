import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddressFinder } from "./address-finder";
import { addressFinderReducer, initialAddressFinder, type AddressFinderState } from "@/lib/addressFinder";

const noop = () => {};

function render(state: AddressFinderState) {
  return renderToStaticMarkup(
    <AddressFinder state={state} onPostcode={noop} onSearch={noop} onChoose={noop} onEnterByHand={noop} onEditField={noop} />
  );
}

const LISTED: AddressFinderState = {
  ...initialAddressFinder,
  postcode: "TQ9 5QH",
  addresses: [
    { address: "10 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
    { address: "12 High Street", town: "TOTNES", postcode: "TQ9 5QH" },
  ],
};

describe("AddressFinder (BL-074 / SPEC-022 Part B)", () => {
  it("B1: starts with a postcode field, a Find address button and the hand-entry control, and no address fields", () => {
    const html = render(initialAddressFinder);
    expect(html).toContain('id="find-postcode"');
    expect(html).toContain("Find address");
    expect(html).toContain("My address isn&#x27;t listed");
    expect(html).not.toContain('id="address-street"');
  });

  it("B1: lists the addresses found to choose from", () => {
    const html = render(LISTED);
    expect(html).toContain('id="pick-address"');
    expect(html).toContain("10 High Street, TOTNES");
    expect(html).toContain("12 High Street, TOTNES");
  });

  it("B1: after a choice the fields show the chosen address", () => {
    const html = render(addressFinderReducer(LISTED, { type: "chosen", index: 1 }));
    expect(html).toMatch(/id="address-street"[^>]*value="12 High Street"/);
    expect(html).toMatch(/id="address-postcode"[^>]*value="TQ9 5QH"/);
    expect(html).toMatch(/id="address-town"[^>]*value="TOTNES"/);
  });

  it("B2: hand entry shows editable street, postcode and town fields", () => {
    const html = render(addressFinderReducer(initialAddressFinder, { type: "enter-by-hand" }));
    expect(html).toContain('id="address-street"');
    expect(html).toContain('id="address-postcode"');
    expect(html).toContain('id="address-town"');
    expect(html).not.toMatch(/id="address-street"[^>]*readonly/i);
  });

  it("B3: a refused lookup shows its message and the fields to enter by hand", () => {
    const html = render(addressFinderReducer(initialAddressFinder, { type: "refused", message: "Please try again tomorrow." }));
    expect(html).toContain("Please try again tomorrow.");
    expect(html).toContain('id="address-street"');
  });
});
