"use client";

import { useEffect, useRef, useState } from "react";

type RotationAxis = "x" | "y" | "xy";

interface ModelViewerProps {
  src: string;
  alt: string;
  height?: string;
  /**
   * Which axis to auto-spin around:
   *  "x"  — tumble forward/back (horizontal axis, phi angle)
   *  "y"  — lazy-susan left/right (vertical axis, theta angle) — default model-viewer auto-rotate
   *  "xy" — slow orbital motion combining both axes
   */
  rotationAxis?: RotationAxis;
  /** Degrees per second. Default 18. Negative values reverse direction. */
  rotationSpeed?: number;
  /**
   * Correct the model's starting orientation as "Xdeg Ydeg Zdeg".
   * ODM exports Z-up models; use "-90deg 0deg 0deg" to lay them flat.
   */
  orientation?: string;
}

export default function ModelViewer({
  src,
  alt,
  height = "600px",
  rotationAxis = "y",
  rotationSpeed = 18,
  orientation,
}: ModelViewerProps) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const userInteracting = useRef(false);
  const viewerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  // Wire load/error via ref — React's synthetic onLoad doesn't fire on web components
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !ready) return;
    const onLoad  = () => setLoaded(true);
    const onError = () => setLoadError(true);
    el.addEventListener("load",  onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load",  onLoad);
      el.removeEventListener("error", onError);
    };
  }, [ready]);

  // Rotation animation — runs after the GLB has loaded
  useEffect(() => {
    const el = viewerRef.current as (HTMLElement & { setAttribute: (k: string, v: string) => void }) | null;
    if (!el || !loaded) return;

    const onDown = () => { userInteracting.current = true; };
    const onUp   = () => { userInteracting.current = false; };
    el.addEventListener("mousedown",  onDown);
    el.addEventListener("touchstart", onDown);
    el.addEventListener("mouseup",    onUp);
    el.addEventListener("touchend",   onUp);

    let rafId: number;
    let startTime: number | null = null;
    let theta = 0;   // horizontal angle (Y axis)
    let phi   = 75;  // elevation angle  (X axis)

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;

      if (!userInteracting.current) {
        const delta = (ts - startTime) / 1000; // seconds since last frame
        startTime = ts;

        if (rotationAxis === "y") {
          theta = (theta + delta * rotationSpeed) % 360;
          el.setAttribute("camera-orbit", `${theta}deg 75deg auto`);
        } else if (rotationAxis === "x") {
          phi = (phi + delta * rotationSpeed) % 360;
          el.setAttribute("camera-orbit", `0deg ${phi}deg auto`);
        } else {
          // "xy" — gentle orbital: slower theta + oscillating phi
          theta = (theta + delta * (rotationSpeed * 0.6)) % 360;
          phi   = 75 + 40 * Math.sin((ts / 1000) * 0.3);
          el.setAttribute("camera-orbit", `${theta}deg ${phi}deg auto`);
        }
      } else {
        startTime = ts; // prevent jump on resume
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mousedown",  onDown);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("mouseup",    onUp);
      el.removeEventListener("touchend",   onUp);
    };
  }, [loaded, rotationAxis, rotationSpeed]);

  return (
    <div style={{ height }} className="relative w-full rounded-xl overflow-hidden bg-gray-100">
      {!loaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 z-10">
          <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading 3D model…</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <p className="text-sm text-red-500">Failed to load 3D model</p>
        </div>
      )}
      {ready && (
        <model-viewer
          ref={viewerRef}
          src={src}
          alt={alt}
          camera-controls
          min-camera-orbit="auto -Infinity auto"
          max-camera-orbit="auto Infinity auto"
          shadow-intensity="1"
          {...(orientation ? { orientation } : {})}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
