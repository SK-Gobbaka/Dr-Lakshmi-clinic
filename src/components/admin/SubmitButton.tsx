"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while its form is being processed, so a double click cannot send the action twice. */
export function SubmitButton({ children, className, pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? "Please wait...") : children}
    </button>
  );
}
