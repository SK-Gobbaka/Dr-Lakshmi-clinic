"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelAppointment } from "@/actions/appointment";

export default function CancelAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      setError("");
      const result = await cancelAppointment({ token, reason });
      if (result.success) {
        setCancelled(true);
      } else {
        setError(result.error);
      }
    });
  };

  if (cancelled) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto h-12 w-12 text-success mb-4" />
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Appointment Cancelled
          </h1>
          <p className="mt-2 text-text-secondary">
            Your appointment has been successfully cancelled.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/book">Book New Appointment</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-white p-8 shadow-sm">
        <XCircle className="h-10 w-10 text-danger mb-4" />
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Cancel Appointment
        </h1>
        <p className="mt-2 text-text-secondary">
          Are you sure you want to cancel your appointment? This action cannot be undone.
        </p>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Label htmlFor="reason">Reason for cancelling (required)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you're cancelling"
            required
            aria-required="true"
            maxLength={200}
            className="mt-1.5"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => router.back()}>
            Go Back
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Confirm Cancel"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
