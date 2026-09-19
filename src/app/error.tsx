"use client";

import { useEffect } from "react";
import { logger } from "@/lib/api/logger";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("unhandled render error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        An unexpected error occurred while rendering this page. It&rsquo;s been logged.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/50 hover:text-black dark:border-white/10 dark:text-white/50 dark:hover:text-white"
      >
        Try again
      </button>
    </div>
  );
}
