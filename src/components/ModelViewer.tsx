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
  const viewerRef = useRef<HTMLElement>(null);

  // Dynamically import model-viewer client-side only.
  // It registers the <model-viewer> custom element as a side-effect.
  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  // Wire load/error events via ref — React's synthetic onLoad does NOT
  // fire reliably on web component custom elements. addEventListener is required.
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

      {/* model-viewer is always rendered once the JS is ready so the
          element exists in the DOM before we attach event listeners */}
      {ready && (
        <model-viewer
          ref={viewerRef}
          src={src}
          alt={alt}
          camera-controls
          auto-rotate
          rotation-per-second="20deg"
          auto-rotate-delay="0"
          shadow-intensity="1"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
