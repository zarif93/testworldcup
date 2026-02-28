import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * When the current user is admin: polls pending submissions count.
 * When the count increases (new form submitted), shows browser Notification + toast.
 */
export function AdminNewSubmissionNotifier() {
  const lastCountRef = useRef<number | undefined>(undefined);

  const { data: pendingCount } = trpc.admin.getPendingSubmissionsCount.useQuery(undefined, {
    refetchInterval: 25_000,
  });

  useEffect(() => {
    if (pendingCount == null) return;

    const prev = lastCountRef.current;
    lastCountRef.current = pendingCount;

    if (prev !== undefined && pendingCount > prev) {
      const title = "טופס חדש התקבל";
      const body = `יש ${pendingCount} טפסים ממתינים לאישור`;

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(title, { body, dir: "rtl" });
          } catch {
            // ignore
          }
        } else if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }

      toast.info(title, {
        description: body,
        duration: 6000,
      });
    }
  }, [pendingCount]);

  return null;
}
