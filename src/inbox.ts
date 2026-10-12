export type WidgetIndicator =
  | "unread-error"
  | "waiting-for-input"
  | "working-draft"
  | "workflow"
  | "background-agent"
  | "background-command"
  | "plan-mode"
  | "goal"
  | "runtime"
  | "draft"
  | "unread-success"
  | "none";

export interface WidgetThread {
  id: string;
  title: string | null;
  titleFallback: string | null;
  providerId: string;
  hasPendingInteraction: boolean;
  indicator: WidgetIndicator;
  isUnread: boolean;
  isArchived: boolean;
  updatedAt: number;
}

const WORKING = new Set<WidgetIndicator>([
  "runtime",
  "workflow",
  "background-agent",
  "background-command",
  "working-draft",
  "plan-mode",
  "goal",
]);

export function threadTitle(thread: WidgetThread): string {
  const title = thread.title?.trim() || thread.titleFallback?.trim();
  return title && title.length > 0 ? title : "Untitled thread";
}

/** The agent is blocked, or it finished and the user has not read it. */
export function needsReply(thread: WidgetThread): boolean {
  return (
    thread.hasPendingInteraction ||
    thread.indicator === "waiting-for-input" ||
    thread.indicator === "unread-error" ||
    thread.indicator === "unread-success"
  );
}

export function statusLabel(thread: WidgetThread): "Needs you" | "Unread" | "Working" | "Idle" {
  if (
    thread.hasPendingInteraction ||
    thread.indicator === "waiting-for-input" ||
    thread.indicator === "unread-error"
  ) {
    return "Needs you";
  }
  if (thread.isUnread || thread.indicator === "unread-success") return "Unread";
  if (WORKING.has(thread.indicator)) return "Working";
  return "Idle";
}

/** Active threads, needs-you first, then most recently updated. */
export function widgetThreads<T extends WidgetThread>(threads: readonly T[], limit = 40): T[] {
  return threads
    .filter((thread) => !thread.isArchived)
    .sort((a, b) => {
      const rank = Number(needsReply(b)) - Number(needsReply(a));
      if (rank !== 0) return rank;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit);
}
