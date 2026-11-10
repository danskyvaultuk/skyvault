"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFECT_SEVERITIES,
  DEFECT_TYPES,
  type CorrectedDefect,
  type ReportCorrection,
} from "@/lib/reportCorrection";

type Props = { reportId: string; held: boolean; photoCount: number; initial: ReportCorrection };

const BLANK_DEFECT: CorrectedDefect = { type: "other", severity: "medium", description: "", image_index: 0 };

const INPUT = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function DefectRow({
  defect, index, photoCount, onChange, onRemove,
}: {
  defect: CorrectedDefect; index: number; photoCount: number;
  onChange: (d: CorrectedDefect) => void; onRemove: () => void;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400">#{index + 1}</span>
        <select className={INPUT} value={defect.type} onChange={(e) => onChange({ ...defect, type: e.target.value as CorrectedDefect["type"] })}>
          {DEFECT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className={INPUT} value={defect.severity} onChange={(e) => onChange({ ...defect, severity: e.target.value as CorrectedDefect["severity"] })}>
          {DEFECT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs text-gray-500">
          Photo{" "}
          <input
            type="number" min={1} max={Math.max(photoCount, 1)} className={`${INPUT} w-20`}
            value={defect.image_index + 1}
            onChange={(e) => onChange({ ...defect, image_index: Math.max(0, Number(e.target.value) - 1) })}
          />
        </label>
        <button type="button" onClick={onRemove} className="ml-auto text-sm text-red-600 hover:underline">Delete</button>
      </div>
      <input
        className={`${INPUT} w-full`} maxLength={150} placeholder="Description (up to 150 characters)"
        value={defect.description} onChange={(e) => onChange({ ...defect, description: e.target.value })}
      />
    </div>
  );
}

export function ReviewForm({ reportId, held, photoCount, initial }: Props) {
  const router = useRouter();
  const [score, setScore] = useState(initial.conditionScore);
  const [defects, setDefects] = useState<CorrectedDefect[]>(initial.defects);
  const [recommendations, setRecommendations] = useState(initial.recommendations.join("\n"));
  const [notes, setNotes] = useState(initial.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(url: string, init: RequestInit, done: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMessage({ ok: false, text: res?.status === 400 ? "Please check the values: something is not valid." : "That didn't work. Please try again." });
      return;
    }
    setMessage({ ok: true, text: done });
    router.refresh();
  }

  function saveCorrection() {
    const body: ReportCorrection = {
      conditionScore: score,
      defects,
      recommendations: recommendations.split("\n").map((r) => r.trim()).filter(Boolean),
      adminNotes: notes.trim() || null,
    };
    return send(`/api/admin/reports/${reportId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }, held ? "Correction saved. The report is still held." : "Correction saved. The customer sees the corrected report now (no email sent).");
  }

  function approve() {
    if (!confirm("Release this report to the customer and email them?")) return;
    return send(`/api/admin/reports/${reportId}/approve`, { method: "POST" }, "Approved. The customer has been emailed.");
  }

  // Released reports only (BL-063): send the "report ready" email again,
  // e.g. after a lost email or a broken link. The report is not changed.
  function resendEmail() {
    if (!confirm("Send the customer the \"report ready\" email again?")) return;
    return send(`/api/admin/reports/${reportId}/resend-email`, { method: "POST" }, "Email re-sent to the customer.");
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-5">
      <h2 className="font-semibold text-gray-900">Review and correct</h2>

      <label className="block text-sm font-medium text-gray-700">
        Condition score (1–10)
        <input type="number" min={1} max={10} className={`${INPUT} w-24 ml-3`} value={score} onChange={(e) => setScore(Number(e.target.value))} />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Defects ({defects.length})</p>
        {defects.map((d, i) => (
          <DefectRow
            key={i} defect={d} index={i} photoCount={photoCount}
            onChange={(next) => setDefects(defects.map((x, j) => (j === i ? next : x)))}
            onRemove={() => setDefects(defects.filter((_, j) => j !== i))}
          />
        ))}
        <button type="button" onClick={() => setDefects([...defects, BLANK_DEFECT])} className="text-sm text-blue-600 hover:underline">
          + Add a defect
        </button>
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Recommendations (one per line)
        <textarea rows={4} className={`${INPUT} w-full mt-1`} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Private notes (admins only — the customer never sees these)
        <textarea rows={3} className={`${INPUT} w-full mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {message && (
        <p className={`text-sm rounded-lg px-3 py-2 ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={saveCorrection}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {busy ? "Saving…" : "Save correction"}
        </button>
        {held && (
          <button type="button" disabled={busy} onClick={approve}
            className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Approve and send to customer
          </button>
        )}
        {!held && (
          <button type="button" disabled={busy} onClick={resendEmail}
            className="border border-blue-300 text-blue-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
            Re-send &quot;report ready&quot; email
          </button>
        )}
      </div>
      {held && (
        <p className="text-xs text-gray-500">Save any corrections before approving. Saving re-makes the PDF.</p>
      )}
    </div>
  );
}
