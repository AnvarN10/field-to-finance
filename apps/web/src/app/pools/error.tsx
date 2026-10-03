"use client";

import { ErrorState } from "@/components/state";

export default function PoolsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Something went wrong" body="The page could not be shown." onRetry={reset} />;
}
