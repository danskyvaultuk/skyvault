"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Property {
  id: string;
  address: string;
  postcode: string;
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [type, setType] = useState<"self_upload" | "drone_capture">("self_upload");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load the customer's properties so they can pick one
  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => {
        setProperties(data);
        if (data.length > 0) setPropertyId(data[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) return setError("Please select a property first.");
    setLoading(true);
    setError("");

    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, type, notes }),
    });

    if (!res.ok) {
      setError("Failed to create survey. Please try again.");
      setLoading(false);
      return;
    }

    const survey = await res.json();
    // Redirect to the upload page for this new survey
    router.push(`/surveys/${survey.id}`);
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New roof survey</h1>
      <p className="text-gray-500 mb-8">
        Choose the property and how you want the survey done.
      </p>

      {properties.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-800 font-medium">No properties yet</p>
          <p className="text-amber-700 text-sm mt-1 mb-4">
            You need to add a property before creating a survey.
          </p>
          <a
            href="/properties/new"
            className="inline-block bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Add property
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Property picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property
            </label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}, {p.postcode}
                </option>
              ))}
            </select>
          </div>

          {/* Survey type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Survey type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("self_upload")}
                className={`border rounded-xl p-4 text-left transition ${
                  type === "self_upload"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-medium text-gray-900">Self upload</p>
                <p className="text-xs text-gray-500 mt-1">
                  Upload your own photos from a phone or drone
                </p>
              </button>
              <button
                type="button"
                onClick={() => setType("drone_capture")}
                className={`border rounded-xl p-4 text-left transition ${
                  type === "drone_capture"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-medium text-gray-900">Drone capture</p>
                <p className="text-xs text-gray-500 mt-1">
                  We send a local operator to capture the images
                </p>
              </button>
            </div>
          </div>

          {/* Optional notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any access instructions or areas of concern..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create survey →"}
          </button>
        </form>
      )}
    </div>
  );
}
