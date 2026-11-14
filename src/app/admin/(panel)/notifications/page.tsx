import Link from "next/link";
import { markAdminNotificationsRead } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { listNotifications } from "@/lib/local-store";
import { Empty, PageTitle, btnPlain, btnPrimary, card, fmtStamp } from "../../ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdmin();
  const items = listNotifications({ audience: "ADMIN" }, 300);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageTitle
        sub={`${unread} unread · full history is kept`}
        action={
          unread > 0 && (
            <form action={markAdminNotificationsRead}>
              <button className={btnPrimary}>Mark all as read</button>
            </form>
          )
        }
      >
        Notifications
      </PageTitle>
      {items.length === 0 ? (
        <Empty>No notifications yet. New bookings, confirmations, cancellations and date blocks appear here.</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className={`${card} p-4 ${n.readAt ? "" : "border-primary/50 bg-sand/20"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-ink">
                  {!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-label="Unread" />}
                  {n.title}
                </p>
                <span className="text-xs text-text-secondary">{fmtStamp(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">{n.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/appointments/${n.appointmentId}`} className={`${btnPlain} h-8 px-3`}>
                  Open {n.appointmentId}
                </Link>
                {!n.readAt && (
                  <form action={markAdminNotificationsRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className={`${btnPlain} h-8 px-3`}>Mark as read</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
