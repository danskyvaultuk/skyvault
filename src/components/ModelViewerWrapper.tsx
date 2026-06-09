"use client";

// This wrapper exists solely to allow dynamic import with ssr: false
// from a Server Component page. dynamic() + ssr:false must live in a
// Client Component — it cannot be called at the Server Component level.

import dynamic from "next/dynamic";
import { Suspense } from "react";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
});

interface Props {
  src: string;
  alt: string;
  height?: string;
  rotationAxis?: "x" | "y" | "xy";
  rotationSpeed?: number;
}

export default function ModelViewerWrapper({ src, alt, height = "600px", rotationAxis, rotationSpeed }: Props) {
  return (
    <Suspense
      fallback={
        <div
          className="w-full rounded-xl bg-gray-100 flex items-center justify-center"
          style={{ height }}
        >
          <p className="text-sm text-gray-400">Loading 3D model…</p>
        </div>
      }
    >
      <ModelViewer src={src} alt={alt} height={height} rotationAxis={rotationAxis} rotationSpeed={rotationSpeed} />
    </Suspense>
  );
}
