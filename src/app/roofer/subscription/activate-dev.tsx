"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActivateDevSubscription({
  currentPlan,
  isActive,
}: {
  currentPlan: string | null;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activate(plan: "basic" | "pro") {
    setLoading(true);
    setError("");

    const res = await fetch("/api/subscriptions/dev-activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to activate subscription");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  async function cancel() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/subscriptions/dev-activate", {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to cancel subscription");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => activate("basic")}
          disabled={loading || (isActive && currentPlan === "basic")}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40"
        >
          {loading ? "…" : "Activate Basic (dev)"}
        </button>
        <button
          onClick={() => activate("pro")}
          disabled={loading || (isActive && currentPlan === "pro")}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-40"
        >
          {loading ? "…" : "Activate Pro (dev)"}
        </button>
        {isActive && (
          <button
            onClick={cancel}
            disabled={loading}
            className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-40"
          >
            {loading ? "…" : "Cancel subscription"}
          </button>
        )}
      </div>
    </div>
  );
}
