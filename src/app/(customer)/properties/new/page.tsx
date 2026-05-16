"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState({ address: "", postcode: "", town: "", type: "residential" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    }
    setLoading(false);
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            placeholder="12 Oak Street"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
            <input
              value={form.postcode}
              onChange={(e) => setForm({ ...form, postcode: e.target.value.toUpperCase() })}
              required
              placeholder="SW1A 1AA"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
            <input
              value={form.town}
              onChange={(e) => setForm({ ...form, town: e.target.value })}
              placeholder="London"
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
