"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Existing = { status: "open" | "closed"; createdAt: string } | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// "Put me in touch with a roofer" (BL-060): asked once per report, with consent.
export function RooferRequestSection({ surveyId, existing }: { surveyId: string; existing: Existing }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (existing?.status === "closed") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6">
        <p className="font-semibold text-green-800">Done — we&apos;ve put you in touch</p>
        <p className="text-sm text-green-700 mt-1">A roofer has your details. Asked on {formatDate(existing.createdAt)}.</p>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
        <p className="font-semibold text-blue-900">Requested on {formatDate(existing.createdAt)} — we&apos;ll be in touch</p>
        <p className="text-sm text-blue-800 mt-1">We&apos;re finding a roofer for you and will email you soon.</p>
      </div>
    );
  }

  async function ask() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/surveys/${surveyId}/roofer-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white border rounded-xl px-5 py-5 mb-6">
      <h2 className="font-semibold text-gray-900">Want a roofer to take a look?</h2>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        We can put you in touch with a local roofer, who will contact you about a quote.
      </p>
      <label className="flex items-start gap-3 text-sm text-gray-700 mb-4">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>SkyVault may share my name, email, address and this report with a roofer.</span>
      </label>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        type="button"
        disabled={!consent || busy}
        onClick={ask}
        className="bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Put me in touch with a roofer"}
      </button>
    </div>
  );
}
