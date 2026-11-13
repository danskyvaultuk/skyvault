"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressFinder } from "@/components/properties/address-finder";
import { useAddressFinder } from "@/hooks/use-address-finder";

// Add property (BL-074 / SPEC-022): postcode first, pick the address or enter it
// by hand, then save through POST /api/properties with the same fields as before.
export default function NewPropertyPage() {
  const router = useRouter();
  const finder = useAddressFinder();
  const [type, setType] = useState("residential");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { fields, showFields } = finder.state;
  const canSave = showFields && fields.address.trim() !== "" && fields.postcode.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: fields.address, postcode: fields.postcode, town: fields.town, type }),
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

        <AddressFinder
          state={finder.state}
          onPostcode={finder.typePostcode}
          onSearch={finder.search}
          onChoose={finder.choose}
          onEnterByHand={finder.enterByHand}
          onEditField={finder.editField}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !canSave}
          className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save property"}
        </button>
      </form>
    </div>
  );
}
