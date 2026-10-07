"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/components/state";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <ErrorState level={1} title="Something went wrong" body="The error was reported. Try again; if it keeps failing, Solana devnet may be slow, so wait a minute." onRetry={reset} />;
}
