"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ImageUploader } from "@/components/surveys/image-uploader";
import { DroneBookingPanel } from "./drone-booking";

interface DroneJob {
  id: string;
  scheduledAt: string | null;
  status: string;
}

interface Survey {
  id: string;
  status: string;
  type: string;
  notes?: string;
  property: { address: string; postcode: string };
  images: { id: string }[];
  droneJob: DroneJob | null;
}

const STATUS_LABELS: Record<string, Record<string, { label: string; colour: string }>> = {
  self_upload: {
    draft:     { label: "Draft — upload images to continue", colour: "bg-gray-100 text-gray-700" },
    pending:   { label: "Pending analysis",                  colour: "bg-amber-100 text-amber-700" },
    analysing: { label: "Analysing with AI…",                colour: "bg-blue-100 text-blue-700" },
    complete:  { label: "Report ready",                      colour: "bg-green-100 text-green-700" },
    failed:    { label: "Analysis failed — please retry",    colour: "bg-red-100 text-red-700" },
  },
  drone_capture: {
    draft:     { label: "Awaiting drone operator",           colour: "bg-amber-100 text-amber-700" },
    pending:   { label: "Images ready — analysis due",       colour: "bg-blue-100 text-blue-700" },
    analysing: { label: "Analysing with AI…",                colour: "bg-blue-100 text-blue-700" },
    complete:  { label: "Report ready",                      colour: "bg-green-100 text-green-700" },
    failed:    { label: "Analysis failed",                   colour: "bg-red-100 text-red-700" },
  },
};

export default function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justBooked = searchParams.get("booked") === "1";

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSurvey(data);
        setImageCount(data.images?.length ?? 0);
        setNotes(data.notes ?? "");
      });
  }, [id]);

  function handleUploadComplete(count: number) {
    setImageCount((prev) => prev + count);
  }

  async function saveNotes() {
    await fetch(`/api/surveys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function handleRetry() {
    await fetch(`/api/surveys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    setSurvey((prev) => prev ? { ...prev, status: "draft" } : prev);
    setError("");
  }

  async function handleAnalyse() {
    setAnalysing(true);
    setError("");
    const res = await fetch(`/api/surveys/${id}/analyse`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Analysis failed. Please try again.");
      setAnalysing(false);
      return;
    }
    router.push(`/surveys/${id}/report`);
  }

  if (!survey) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const isDrone = survey.type === "drone_capture";
  const typeLabels = STATUS_LABELS[survey.type] ?? STATUS_LABELS.self_upload;
  const statusInfo = typeLabels[survey.status] ?? typeLabels.draft;
  const canAnalyse = imageCount >= 1 && (survey.status === "draft" || survey.status === "pending");
  const droneBooked = justBooked || !!survey.droneJob;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.property.address}</h1>
        <p className="text-gray-500">{survey.property.postcode}</p>
        <div className="mt-3 flex items-center gap-3">
          {/* Hide the draft label for self-upload — the upload form makes the state obvious */}
          {(!isDrone && survey.status !== "draft") && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.colour}`}>
              {statusInfo.label}
            </span>
          )}
          {(isDrone || survey.status !== "draft") && (
            <span className="text-sm text-gray-400">
              {isDrone ? "Drone capture" : "Self upload"}
            </span>
          )}
          {isDrone && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.colour}`}>
              {statusInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* ── DRONE CAPTURE FLOW ─────────────────────────────────────────── */}
      {isDrone && (
        <>
          {survey.status === "draft" && !droneBooked && (
            <DroneBookingPanel surveyId={survey.id} />
          )}

          {survey.status === "draft" && droneBooked && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 mb-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🚁</span>
                <div>
                  <p className="font-semibold text-blue-900 mb-1">Booking confirmed!</p>
                  {survey.droneJob?.scheduledAt && (
                    <p className="text-sm text-blue-700 font-medium mb-2">
                      Preferred slot:{" "}
                      {new Date(survey.droneJob.scheduledAt).toLocaleString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <p className="text-sm text-blue-700">
                    A drone operator will accept your job and be in touch to confirm the visit.
                    High-quality aerial images will be uploaded directly to your survey.
                  </p>
                  <p className="text-sm text-blue-600 mt-3 font-medium">
                    You&apos;ll be notified by email once the images are ready and your report has been generated.
                  </p>
                </div>
              </div>
            </div>
          )}

          {survey.status === "pending" && (
            <div className="space-y-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <p className="text-green-700 font-semibold text-sm">Drone images ready</p>
                <p className="text-green-600 text-sm mt-1">
                  Your drone operator has completed the capture. Run the AI analysis to get your report.
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                onClick={handleAnalyse}
                disabled={analysing}
                className="w-full bg-blue-700 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
              >
                {analysing ? "Sending to AI — this takes about 30 seconds…" : "Generate my roof report →"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── SELF UPLOAD FLOW ───────────────────────────────────────────── */}
      {!isDrone && (
        <>
          <div className="bg-white border rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Images uploaded</p>
              <p className="text-2xl font-bold text-gray-900">{imageCount} / 10</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Max images</p>
              <p className="text-2xl font-bold text-gray-400">10</p>
            </div>
          </div>

          {survey.status === "draft" && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Upload roof images</h2>
              <p className="text-sm text-gray-500 mb-4">
                Upload clear photos of the roof from different angles. Include close-ups of any
                areas you&apos;re concerned about.
              </p>
              <ImageUploader surveyId={id} onUploadComplete={handleUploadComplete} />
            </div>
          )}

          {/* Customer concerns — saved to notes, passed to Claude at analysis time */}
          {survey.status === "draft" && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Any concerns or areas to focus on?
                </label>
                {notesSaved && (
                  <span className="text-xs text-green-600">Saved</span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={3}
                maxLength={500}
                placeholder="e.g. Crack on the left chimney, missing tiles at the front, damp patch in the back bedroom…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{notes.length}/500 — saved automatically. This is sent to the AI alongside your images.</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {(survey.status === "draft" || survey.status === "pending") && (
            <button
              onClick={handleAnalyse}
              disabled={!canAnalyse || analysing}
              className="w-full bg-blue-700 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analysing
                ? "Sending to AI — this takes about 30 seconds…"
                : canAnalyse
                ? "Analyse roof with AI →"
                : "Upload an image to continue"}
            </button>
          )}

          {survey.status === "failed" && (
            <button
              onClick={handleRetry}
              className="w-full bg-amber-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-amber-700 mb-3"
            >
              Retry analysis
            </button>
          )}
        </>
      )}

      {/* ── SHARED ─────────────────────────────────────────────────────── */}
      {survey.status === "analysing" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <p className="text-blue-700 font-semibold text-sm">Analysing your roof…</p>
          <p className="text-blue-600 text-sm mt-1">
            This usually takes about 30 seconds. You can leave this page and come back.
          </p>
        </div>
      )}

      {survey.status === "complete" && (
        <a
          href={`/surveys/${id}/report`}
          className="block w-full text-center bg-green-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-green-700"
        >
          View your report →
        </a>
      )}

      {survey.notes && (
        <div className="mt-6 bg-gray-50 border rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
          <p className="text-sm text-gray-600">{survey.notes}</p>
        </div>
      )}
    </div>
  );
}
