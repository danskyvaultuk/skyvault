"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });

    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Delete {userName || "user"}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg disabled:opacity-50"
        >
          {loading ? "…" : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
    >
      Delete
    </button>
  );
}
