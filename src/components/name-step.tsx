"use client";

// Asked once of a signed-in customer with no name saved (BL-081 / SPEC-030 B1,
// B2), in place of the page they asked for. Saving refreshes that same page,
// which then shows as normal.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX } from "@/lib/displayName";

export function NameStep() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/account/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
      return;
    }
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setError(body?.error ?? "Something went wrong. Please try again.");
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <form onSubmit={save} className="w-full max-w-sm bg-white border rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">What should we call you?</h1>
          <p className="text-sm text-gray-500 mt-1">We&apos;ll use this in your reports and emails.</p>
        </div>
        <div>
          <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            maxLength={DISPLAY_NAME_MAX}
            required
            placeholder="e.g. Jane"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[44px] bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
