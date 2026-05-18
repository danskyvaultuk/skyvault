"use client";

import { useState } from "react";

export function ManageButton({ label = "Manage subscription" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleManage() {
    setLoading(true);

    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (!res.ok) { setLoading(false); return; }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <button
      onClick={handleManage}
      disabled={loading}
      className="text-sm text-blue-600 hover:underline disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? "Loading…" : label}
    </button>
  );
}
