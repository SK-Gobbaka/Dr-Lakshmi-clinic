"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
      <h1 className="font-heading text-xl font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-sm">Something went wrong while loading it. Your data is safe. Try again, and if it keeps happening, tell the person who looks after the website.</p>
      {error.digest && <p className="mt-2 text-xs">Reference: {error.digest}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8]">
          Try again
        </button>
        <Link href="/admin" className="inline-flex h-11 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-ink hover:bg-sand/50">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
