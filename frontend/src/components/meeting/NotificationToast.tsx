import type { NotificationEntry } from "../../hooks/useMeeting";

interface NotificationToastProps {
  notifications: NotificationEntry[];
}

export function NotificationToast({ notifications }: NotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-50 flex w-72 -translate-x-1/2 flex-col items-center gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="rounded-lg border border-brand-border bg-brand-text/90 px-4 py-2 text-sm text-white shadow-soft"
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}
