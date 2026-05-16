"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ImageUploader } from "@/components/surveys/image-uploader";

interface Survey {
  id: string;
  status: string;
  type: string;
  notes?: string;
  property: {
    address: string;
    postcode: string;
  };
  images: { id: string }[];
}

const STATUS_LABELS: Record<string, Record<string, { label: string; colour: string }>> = {
  self_upload: {
    draft:      { label: "Draft — upload images to continue",  colour: "bg-gray-100 text-gray-700" },
    pending:    { label: "Pending analysis",                   colour: "bg-amber-100 text-amber-700" },
    analysing:  { label: "Analysing with AI…",                 colour: "bg-blue-100 text-blue-700" },
    complete:   { label: "Report ready",                       colour: "bg-green-100 text-green-700" },
    failed:     { label: "Analysis failed — please retry",     colour: "bg-red-100 text-red-700" },
  },
  drone_capture: {
    draft:      { label: "Awaiting drone operator",            colour: "bg-amber-100 text-amber-700" },
    pending:    { label: "Images ready — analysis due",        colour: "bg-blue-100 text-blue-700" },
    analysing:  { label: "Analysing with AI…",                 colour: "bg-blue-100 text-blue-700" },
    complete:   { label: "Report ready",                       colour: "bg-green-100 text-green-700" },
    failed:     { label: "Analysis failed",                    colour: "bg-red-100 text-red-700" },
  },
};

export default function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/surveys/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSurvey(data);
        setImageCount(data.images?.length ?? 0);
      });
  }, [id]);

  // Called by ImageUploader each time an upload batch finishes
  function handleUploadComplete(count: number) {
    setImageCount((prev) => prev + count);
  }

  async function handleRetry() {
    // Reset status to draft via PATCH, then re-analyse
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

    const { reportId } = await res.json();
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

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{survey.property.address}</h1>
        <p className="text-gray-500">{survey.property.postcode}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.colour}`}>
            {statusInfo.label}
          </span>
          <span className="text-sm text-gray-400">
            {isDrone ? "Drone capture" : "Self upload"}
          </span>
        </div>
      </div>

      {/* ── DRONE CAPTURE FLOW ─────────────────────────────────────────────────── */}
      {isDrone && (
        <>
          {(survey.status === "draft") && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 mb-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🚁</span>
                <div>
                  <p className="font-semibold text-blue-900 mb-1">A drone operator will be in touch</p>
                  <p className="text-sm text-blue-700">
                    Your job has been posted to our network of drone operators. One will accept the job,
                    fly out to your property, and upload high-quality aerial images directly to your survey.
                  </p>
                  <p className="text-sm text-blue-600 mt-3 font-medium">
                    You&apos;ll be notified by email once the images are ready and your report has been generated. There&apos;s nothing more you need to do.
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
                  Your drone operator has completed the capture and uploaded the images. Run the AI analysis to get your report.
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

      {/* ── SELF UPLOAD FLOW ───────────────────────────────────────────────────── */}
      {!isDrone && (
        <>
          {/* Image count */}
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

          {/* Uploader — only in draft */}
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

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {/* Analyse button */}
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

          {/* Retry */}
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

      {/* ── SHARED: report ready ───────────────────────────────────────────────── */}
      {survey.status === "analysing" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <p className="text-blue-700 font-semibold text-sm">Analysing your roof…</p>
          <p className="text-blue-600 text-sm mt-1">This usually takes about 30 seconds. You can leave this page and come back.</p>
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

      {/* Notes */}
      {survey.notes && (
        <div className="mt-6 bg-gray-50 border rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
          <p className="text-sm text-gray-600">{survey.notes}</p>
        </div>
      )}
    </div>
  );
}
