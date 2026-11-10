"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkHandledButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function markHandled() {
    if (!confirm("Mark this request handled? The customer will see \"we've put you in touch\".")) return;
    setBusy(true);
    setFailed(false);
    const res = await fetch(`/api/admin/roofer-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={markHandled}
        className="bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Mark handled"}
      </button>
      {failed && <span className="text-xs text-red-600 ml-2">Didn&apos;t save — try again</span>}
    </>
  );
}
