"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImpersonateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data.redirect) router.push(data.redirect);
    else setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
    >
      {loading ? "…" : "Switch to"}
    </button>
  );
}
