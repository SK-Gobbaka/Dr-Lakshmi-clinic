import Link from "next/link";
import { btnPlain } from "../ui";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">Not found</h1>
      <p className="mt-2 text-text-secondary">That record does not exist. It may have been deleted.</p>
      <Link href="/admin" className={`${btnPlain} mt-6`}>
        Back to dashboard
      </Link>
    </div>
  );
}
