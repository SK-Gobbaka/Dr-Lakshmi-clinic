"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="font-heading text-2xl font-bold text-text-primary">
          Something went wrong
        </h2>
        <p className="mt-2 text-text-secondary">
          We encountered an unexpected error. Please try again.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
