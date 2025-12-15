import React, { useMemo } from "react";
import { Link } from "wouter";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLog } from "@/hooks/useLogs";
import { useActiveIntervention } from "@/hooks/useInterventions";
import { useStore } from "@/lib/store";

type AppNotification = {
  id: string;
  title: string;
  description: string;
  href?: string;
};

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function NotificationCenter() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toYmd(today), [today]);

  const { log: todayLog, isLoading: todayLogLoading } = useLog(todayKey);
  const { activeIntervention } = useActiveIntervention();

  const dismissed = useStore((s) => s.dismissedNotificationIds);
  const dismissNotification = useStore((s) => s.dismissNotification);
  const clearDismissedNotifications = useStore((s) => s.clearDismissedNotifications);

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];

    // Daily log reminder (only if we can reasonably determine it's missing)
    if (!todayLogLoading && !todayLog) {
      items.push({
        id: `daily-log:${todayKey}`,
        title: "Today’s action: complete your Daily Log",
        description: "Logging today keeps trends accurate and keeps your intervention on track.",
        href: "/log",
      });
    }

    // Intervention reminder
    if (activeIntervention) {
      const unlockDay = startOfDay(new Date(activeIntervention.endDate));
      const remaining = Math.max(0, differenceInCalendarDays(unlockDay, startOfDay(new Date())));

      if (remaining <= 0) {
        items.push({
          id: `intervention-checkin:${activeIntervention.id}`,
          title: "Intervention check-in is available",
          description: "Log the outcome to resume new insights.",
          href: "/history",
        });
      } else {
        items.push({
          id: `intervention-checkin:${activeIntervention.id}`,
          title: "Check-in unlocks soon",
          description: `Available in ${remaining} day${remaining === 1 ? "" : "s"} (on ${format(unlockDay, "MMM dd, yyyy")}).`,
          href: "/history",
        });
      }
    }

    return items;
  }, [activeIntervention, todayKey, todayLog, todayLogLoading]);

  const visible = useMemo(
    () => notifications.filter((n) => !dismissed.includes(n.id)),
    [notifications, dismissed]
  );

  const unreadCount = visible.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center"
              aria-hidden="true"
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[360px] sm:w-[420px]">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Reminders and progress nudges.</SheetDescription>
            </div>
            {dismissed.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clearDismissedNotifications}
              >
                Restore
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {visible.length === 0 ? (
            <div className="text-sm text-muted-foreground">No new notifications.</div>
          ) : (
            visible.map((n) => (
              <div key={n.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-snug">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{n.description}</div>

                  {n.href && (
                    <div className="mt-3">
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={n.href}>Open</Link>
                      </Button>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Dismiss"
                  onClick={() => dismissNotification(n.id)}
                >
                  <X />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
