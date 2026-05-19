"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setShow(true);
      // Clean the URL without triggering a navigation
      router.replace("/roofer/subscription", { scroll: false });
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
      <span className="text-green-500 text-xl">✓</span>
      <div>
        <p className="font-semibold text-green-800">Subscription activated!</p>
        <p className="text-sm text-green-600 mt-0.5">
          You now have full access to leads in your area.
        </p>
      </div>
    </div>
  );
}
