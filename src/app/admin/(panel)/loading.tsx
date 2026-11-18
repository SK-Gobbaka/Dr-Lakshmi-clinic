import { Skeleton } from "@/components/ui/skeleton";

// Without this the public site's full-page hero skeleton flashes inside the admin panel.
export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
