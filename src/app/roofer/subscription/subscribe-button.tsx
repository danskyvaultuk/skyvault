"use client";

import { useState } from "react";

export function SubscribeButton({ plan, highlight }: { plan: "basic" | "pro"; highlight?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 ${
          highlight
            ? "bg-blue-700 text-white hover:bg-blue-800"
            : "bg-gray-900 text-white hover:bg-gray-800"
        }`}
      >
        {loading ? "Redirecting…" : "Subscribe"}
      </button>
    </div>
  );
}
