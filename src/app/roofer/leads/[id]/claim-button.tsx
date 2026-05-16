"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ClaimButton({
  leadId,
  isSubscribed,
  isFull,
}: {
  leadId: string;
  isSubscribed: boolean;
  isFull: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClaim() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to claim lead");
      setLoading(false);
      return;
    }

    router.refresh(); // reload page to show customer contact details
  }

  if (!isSubscribed) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-center">
        <p className="text-amber-800 font-medium mb-2">Subscription required to claim this lead</p>
        <Link href="/roofer/subscription"
          className="inline-block bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
          View plans
        </Link>
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="bg-gray-50 border rounded-xl px-5 py-4 text-center text-gray-500 text-sm">
        This lead has already been claimed by the maximum number of roofers.
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}
      <button
        onClick={handleClaim}
        disabled={loading}
        className="w-full bg-blue-700 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
      >
        {loading ? "Claiming…" : "Claim this lead — see contact details →"}
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">
        Claiming uses 1 lead from your monthly allowance.
      </p>
    </div>
  );
}
