// The Add property address step (BL-074 / SPEC-022 Part B): a postcode field
// and "Find address", a list of the addresses found, a "My address isn't
// listed" control, and the editable address fields. Presentational only; the
// state comes from useAddressFinder.
import type { AddressFields, AddressFinderState } from "@/lib/addressFinder";

type Props = {
  state: AddressFinderState;
  onPostcode: (value: string) => void;
  onSearch: () => void;
  onChoose: (index: number) => void;
  onEnterByHand: () => void;
  onEditField: (field: keyof AddressFields, value: string) => void;
};

const INPUT = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

function AddressFieldsBlock({ fields, onEditField }: Pick<Props, "onEditField"> & { fields: AddressFields }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="address-street" className={LABEL}>Street address</label>
        <input id="address-street" value={fields.address} onChange={(e) => onEditField("address", e.target.value)} required placeholder="e.g. 12 High Street" className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="address-postcode" className={LABEL}>Postcode</label>
          <input id="address-postcode" value={fields.postcode} onChange={(e) => onEditField("postcode", e.target.value.toUpperCase())} required placeholder="TQ9 5QH" className={INPUT} />
        </div>
        <div>
          <label htmlFor="address-town" className={LABEL}>Town / City</label>
          <input id="address-town" value={fields.town} onChange={(e) => onEditField("town", e.target.value)} placeholder="Totnes" className={INPUT} />
        </div>
      </div>
    </div>
  );
}

export function AddressFinder({ state, onPostcode, onSearch, onChoose, onEnterByHand, onEditField }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="find-postcode" className={LABEL}>Postcode</label>
        <div className="flex gap-2">
          <input
            id="find-postcode"
            value={state.postcode}
            onChange={(e) => onPostcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch();
              }
            }}
            autoComplete="postal-code"
            placeholder="e.g. TQ9 5QH"
            className={INPUT}
          />
          <button
            type="button"
            onClick={onSearch}
            disabled={state.searching || state.postcode.trim() === ""}
            className="shrink-0 bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {state.searching ? "Searching…" : "Find address"}
          </button>
        </div>
      </div>

      {state.message && <p role="status" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{state.message}</p>}

      {state.addresses.length > 0 && (
        <div>
          <label htmlFor="pick-address" className={LABEL}>Select your address</label>
          <select id="pick-address" defaultValue="" onChange={(e) => onChoose(Number(e.target.value))} className={INPUT}>
            <option value="" disabled>{state.addresses.length} addresses found — choose yours</option>
            {state.addresses.map((a, i) => (
              <option key={`${a.address}-${i}`} value={i}>{a.address}, {a.town}</option>
            ))}
          </select>
        </div>
      )}

      {!state.showFields && (
        <button type="button" onClick={onEnterByHand} className="text-sm text-blue-600 hover:underline">
          My address isn&apos;t listed — enter it by hand
        </button>
      )}

      {state.showFields && <AddressFieldsBlock fields={state.fields} onEditField={onEditField} />}
    </div>
  );
}
