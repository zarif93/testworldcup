/**
 * Phase 22: Bell icon + unread count for user/agent. Opens notifications page on click.
 */

import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export function UserNotificationsBell() {
  const [, setLocation] = useLocation();
  const { data: unreadCount } = trpc.notifications.getMyUnreadCount.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const count = typeof unreadCount === "number" ? unreadCount : 0;

  return (
    <button
      type="button"
      onClick={() => setLocation("/notifications")}
      className="relative flex items-center justify-center p-2 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-slate-800/50 transition min-h-[44px] min-w-[44px]"
      aria-label={count > 0 ? `${count} התראות לא נקראו` : "התראות"}
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
