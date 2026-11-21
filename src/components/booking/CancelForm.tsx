"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelAppointment } from "@/actions/appointment";

interface Props {
  token: string;
  summary: { id: string; name: string; what: string; when: string };
}

export function CancelForm({ token, summary }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      setError("");
      try {
        const result = await cancelAppointment({ token, reason });
        if (result.success) setCancelled(true);
        else setError(result.error);
      } catch {
        setError("We could not reach the server. Please check your connection and try again.");
      }
    });
  };

  if (cancelled) {
    return (
      <div className="text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-success mb-4" aria-hidden />
        <h1 className="font-heading text-2xl font-bold text-text-primary">Appointment cancelled</h1>
        <p className="mt-2 text-text-secondary">Appointment {summary.id} has been cancelled.</p>
        <Button className="mt-6" asChild>
          <Link href="/book">Book a new appointment</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <XCircle className="h-10 w-10 text-danger mb-4" aria-hidden />
      <h1 className="font-heading text-2xl font-bold text-text-primary">Cancel appointment</h1>
      <dl className="mt-4 space-y-1 rounded-xl bg-gray-50 p-4 text-sm">
        <div className="flex gap-2">
          <dt className="text-text-secondary">Appointment</dt>
          <dd className="font-semibold text-text-primary">{summary.id}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-secondary">Name</dt>
          <dd className="font-semibold text-text-primary">{summary.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-secondary">For</dt>
          <dd className="font-semibold text-text-primary">{summary.what}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-secondary">When</dt>
          <dd className="font-semibold text-text-primary">{summary.when}</dd>
        </div>
      </dl>
      <p className="mt-4 text-text-secondary">Are you sure you want to cancel this appointment? This cannot be undone.</p>

      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6">
        <Label htmlFor="reason">Reason for cancelling (required)</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why you're cancelling" required aria-required="true" maxLength={200} className="mt-1.5" />
      </div>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/">Keep my appointment</Link>
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleCancel} disabled={isPending || reason.trim().length < 3}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cancelling...
            </>
          ) : (
            "Confirm cancel"
          )}
        </Button>
      </div>
    </>
  );
}
