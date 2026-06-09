"use client";

import { useEffect, useRef, useState } from "react";

interface ModelViewerProps {
  src: string;
  alt: string;
  height?: string;
}

export default function ModelViewer({
  src,
  alt,
  height = "600px",
}: ModelViewerProps) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // userInteracting pauses the animation while the user is dragging
  const userInteracting = useRef(false);
  const viewerRef = useRef<HTMLElement>(null);

  // Dynamically import model-viewer client-side only.
  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  // Wire load/error events via ref — React's synthetic onLoad doesn't fire
  // reliably on web component custom elements.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !ready) return;

    const onLoad = () => setLoaded(true);
    const onError = () => setLoadError(true);

    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [ready]);

  // Horizontal-axis spin: animate phi (elevation angle) via rAF.
  // model-viewer's built-in auto-rotate only spins around the vertical
  // axis; we need JS to spin around the horizontal axis instead.
  useEffect(() => {
    const el = viewerRef.current as (HTMLElement & { setAttribute: (k: string, v: string) => void }) | null;
    if (!el || !loaded) return;

    // Track user drag start/end so we can pause animation
    const onMousedown = () => { userInteracting.current = true; };
    const onMouseup   = () => { userInteracting.current = false; };
    el.addEventListener("mousedown", onMousedown);
    el.addEventListener("touchstart", onMousedown);
    el.addEventListener("mouseup",   onMouseup);
    el.addEventListener("touchend",  onMouseup);

    let rafId: number;
    let startTime: number | null = null;
    // Keep a running angle so the animation resumes smoothly after interaction
    let phi = 75; // degrees — starting elevation angle

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;

      if (!userInteracting.current) {
        // Advance phi ~18 degrees per second → full 360° tumble in 20s
        const delta = (ts - startTime) / 1000;
        startTime = ts;
        phi = (phi + delta * 18) % 360;
        el.setAttribute("camera-orbit", `0deg ${phi}deg auto`);
      } else {
        // Reset startTime so delta doesn't jump when interaction ends
        startTime = ts;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mousedown", onMousedown);
      el.removeEventListener("touchstart", onMousedown);
      el.removeEventListener("mouseup",   onMouseup);
      el.removeEventListener("touchend",  onMouseup);
    };
  }, [loaded]);

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden bg-gray-100"
    >
      {/* Loading overlay — hidden once GLB has loaded */}
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
          // No auto-rotate — we drive the orbit manually in the useEffect above
          // Allow full 360° phi rotation (default clamps to 0–180)
          min-camera-orbit="auto -Infinity auto"
          max-camera-orbit="auto Infinity auto"
          shadow-intensity="1"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
