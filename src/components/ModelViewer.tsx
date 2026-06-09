"use client";

import { useEffect, useState } from "react";

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

  // Dynamically import model-viewer client-side only.
  // It registers the <model-viewer> custom element as a side-effect.
  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden bg-gray-100"
    >
      {/* Loading overlay — shown until the GLB has fully loaded */}
      {(!ready || !loaded) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 z-10">
          <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading 3D model…</p>
        </div>
      )}

      {ready && (
        <model-viewer
          src={src}
          alt={alt}
          camera-controls
          auto-rotate
          shadow-intensity="1"
          style={{ width: "100%", height: "100%" }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
