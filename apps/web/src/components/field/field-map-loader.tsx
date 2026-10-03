"use client";

import dynamic from "next/dynamic";

export const FieldMapLoader = dynamic(() => import("./field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-label="Loading map" />,
});
