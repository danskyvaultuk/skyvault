"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
  };
}

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

export default function NewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState({ address: "", postcode: "", town: "", type: "residential" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addrDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pcDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleAddressInput(value: string) {
    setForm((f) => ({ ...f, address: value }));
    clearTimeout(addrDebounce.current);
    if (value.length < 6) { setSuggestions([]); return; }
    addrDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&countrycodes=gb&limit=8&addressdetails=1`,
          { headers: { "Accept-Language": "en-GB" } }
        );
        const data: NominatimResult[] = await res.json();
        // Only show results that have a recognisable road — filters out POIs and landmarks
        const filtered = data.filter((r) => r.address.road);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch { /* ignore */ }
    }, 350);
  }

  function handlePostcodeInput(value: string) {
    const upper = value.toUpperCase();
    setForm((f) => ({ ...f, postcode: upper }));
    clearTimeout(pcDebounce.current);
    if (!UK_POSTCODE_RE.test(upper)) return;
    pcDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(upper)}`);
        const data = await res.json();
        if (data.result) {
          const locality = data.result.admin_district ?? data.result.parish ?? "";
          setForm((f) => ({ ...f, town: f.town || locality }));
        }
      } catch { /* ignore */ }
    }, 300);
  }

  function selectSuggestion(result: NominatimResult) {
    const { house_number, road, city, town, village, postcode } = result.address;
    const street = [house_number, road].filter(Boolean).join(" ") || road || "";
    const locality = city ?? town ?? village ?? "";
    setForm((f) => ({
      ...f,
      address: street,
      postcode: postcode?.toUpperCase() ?? f.postcode,
      town: locality || f.town,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const property = await res.json();
      router.push(`/properties/${property.id}`);
    } else {
      const data = await res.json();
      setError(data.error?.fieldErrors ? "Please check your inputs." : data.error ?? "Failed to save property");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Add property</h1>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Address with autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
          <p className="text-xs text-gray-400 mb-1">Type your street name to search, then adjust the house number if needed</p>
          <input
            value={form.address}
            onChange={(e) => handleAddressInput(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            required
            autoComplete="off"
            placeholder="e.g. High Street, Totnes"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto text-sm">
              {suggestions.map((s) => {
                const { house_number, road, town, city, village, postcode } = s.address;
                const label = [house_number, road, town ?? city ?? village, postcode]
                  .filter(Boolean).join(", ");
                return (
                  <li
                    key={s.place_id}
                    onMouseDown={() => selectSuggestion(s)}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-700"
                  >
                    {label || s.display_name}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
            <input
              value={form.postcode}
              onChange={(e) => handlePostcodeInput(e.target.value)}
              required
              placeholder="TQ9 5QH"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
            <input
              value={form.town}
              onChange={(e) => setForm({ ...form, town: e.target.value })}
              placeholder="Totnes"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save property"}
        </button>
      </form>
    </div>
  );
}
