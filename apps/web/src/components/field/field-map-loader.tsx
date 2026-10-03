"use client";

import dynamic from "next/dynamic";

export const FieldMapLoader = dynamic(() => import("./field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full skeleton-shimmer rounded-lg" role="status" aria-label="Loading map" />,
});
