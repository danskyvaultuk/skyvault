"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyToggle({ userId, verified }: { userId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(verified);

  async function handleToggle() {
    setLoading(true);
    const newValue = !state;

    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: newValue }),
    });

    setState(newValue);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        state ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          state ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
