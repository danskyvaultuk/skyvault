"use client";

import { useEffect, useRef, useState } from "react";

export type SurveyStatus = "draft" | "pending" | "analysing" | "complete" | "failed";

export function useSurveyPoll(surveyId: string, initialStatus: SurveyStatus) {
  const [status, setStatus] = useState<SurveyStatus>(initialStatus);
  const [reportId, setReportId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "analysing" && status !== "pending") return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        if (data.report?.id) setReportId(data.report.id);
      } catch {
        // ignore transient network errors
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [surveyId, status]);

  return { status, reportId };
}
