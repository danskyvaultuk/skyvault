"use client";

// Sends a known test error to Sentry (BL-054 / SPEC-020 C2). The server
// answers 500 because the error is real; that is the expected outcome.
import { useState } from "react";

export function SentryTestButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function send() {
    setState("sending");
    const res = await fetch("/api/admin/sentry-test", { method: "POST" }).catch(() => null);
    setState(res?.status === 500 ? "sent" : "failed");
  }

  return (
    <div className="bg-white border rounded-xl px-5 py-4 mb-8">
      <h2 className="font-semibold text-gray-900 mb-1">Error monitoring</h2>
      <p className="text-sm text-gray-500 mb-3">
        Sends a test error to Sentry. It should appear in Sentry&apos;s Issues within a minute, titled &quot;Sentry test error&quot; and the time.
      </p>
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send a test error to Sentry"}
      </button>
      {state === "sent" && <p className="text-sm text-green-700 mt-2">Test error sent. Check Sentry&apos;s Issues page.</p>}
      {state === "failed" && <p className="text-sm text-red-700 mt-2">That didn&apos;t send. Please try again.</p>}
    </div>
  );
}
