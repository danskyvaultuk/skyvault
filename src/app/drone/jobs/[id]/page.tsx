"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ImageUploader } from "@/components/surveys/image-uploader";

interface Job {
  id: string;
  status: string;
  payoutAmount: string;
  operatorId: string | null;
  survey: {
    id: string;
    notes: string | null;
    images: { id: string }[];
    property: {
      address: string;
      postcode: string;
      town: string | null;
      type: string;
    };
  };
}

const STATUS_INFO: Record<string, { label: string; colour: string }> = {
  posted:          { label: "Available — not yet accepted",  colour: "bg-blue-100 text-blue-700" },
  accepted:        { label: "Accepted — awaiting images",    colour: "bg-amber-100 text-amber-700" },
  in_progress:     { label: "In progress",                   colour: "bg-amber-100 text-amber-700" },
  images_uploaded: { label: "Images uploaded — complete",    colour: "bg-green-100 text-green-700" },
  complete:        { label: "Complete",                       colour: "bg-gray-100 text-gray-600" },
};

export default function OperatorJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/drone-jobs/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setJob(data);
        setImageCount(data.survey.images?.length ?? 0);
      });
  }, [id]);

  async function handleAction(action: "accept" | "complete") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/drone-jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const updated = await res.json();
    setJob((prev) => prev ? { ...prev, status: updated.status } : prev);
    setLoading(false);

    if (action === "complete") router.push("/drone/dashboard");
  }

  if (!job) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const statusInfo = STATUS_INFO[job.status] ?? STATUS_INFO.posted;
  const isAccepted = job.status === "accepted" || job.status === "in_progress";
  const canComplete = isAccepted && imageCount >= 1;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{job.survey.property.address}</h1>
        <p className="text-gray-500">
          {job.survey.property.postcode}
          {job.survey.property.town ? ` · ${job.survey.property.town}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.colour}`}>
            {statusInfo.label}
          </span>
          <span className="text-sm font-semibold text-green-600">
            £{Number(job.payoutAmount).toFixed(2)} payout
          </span>
        </div>
      </div>

      {/* Property details */}
      <div className="bg-white border rounded-xl px-5 py-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Property details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium text-gray-900 capitalize">{job.survey.property.type}</p>
          </div>
          <div>
            <p className="text-gray-500">Images uploaded</p>
            <p className="font-medium text-gray-900">{imageCount}</p>
          </div>
        </div>
        {job.survey.notes && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-gray-500 text-sm">Customer notes</p>
            <p className="text-sm text-gray-800 mt-0.5">{job.survey.notes}</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Accept button — only shown for posted jobs */}
      {job.status === "posted" && (
        <button
          onClick={() => handleAction("accept")}
          disabled={loading}
          className="w-full bg-blue-700 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-50 mb-4"
        >
          {loading ? "Accepting…" : "Accept this job →"}
        </button>
      )}

      {/* Image uploader — shown once accepted */}
      {isAccepted && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Upload roof images</h2>
          <p className="text-sm text-gray-500 mb-4">
            Fly the drone and capture clear images of all roof sections. Upload them here,
            then mark the job complete.
          </p>
          <ImageUploader
            surveyId={job.survey.id}
            onUploadComplete={(count) => setImageCount((prev) => prev + count)}
          />
        </div>
      )}

      {/* Complete button */}
      {isAccepted && (
        <button
          onClick={() => handleAction("complete")}
          disabled={!canComplete || loading}
          className="w-full bg-green-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? "Submitting…"
            : canComplete
            ? "Mark job complete →"
            : "Upload at least 1 image to complete"}
        </button>
      )}

      {/* Done state */}
      {job.status === "images_uploaded" && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
          <p className="text-green-700 font-semibold">Job complete!</p>
          <p className="text-green-600 text-sm mt-1">
            Images submitted. The customer has been notified and your payout will be processed.
          </p>
        </div>
      )}
    </div>
  );
}
