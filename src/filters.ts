import { needsReply, statusLabel, threadTitle, type WidgetThread } from "./inbox.ts";

export const STATUS_FILTERS = ["all", "needs_you", "working", "unread", "idle", "draft"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  needs_you: "Needs you",
  working: "Working",
  unread: "Unread",
  idle: "Idle",
  draft: "Draft",
};

export const SORTS = ["needs_you_first", "attention_desc", "updated_desc", "created_desc", "title_asc"] as const;
export type WidgetSort = (typeof SORTS)[number];
export const SORT_LABELS: Record<WidgetSort, string> = {
  needs_you_first: "Needs you first",
  attention_desc: "Recent attention",
  updated_desc: "Recently updated",
  created_desc: "Newest created",
  title_asc: "Title A–Z",
};

export const LABEL_MODES = ["all", "only", "hide"] as const;
export type LabelMode = (typeof LABEL_MODES)[number];
export const LABEL_MODE_LABELS: Record<LabelMode, string> = {
  all: "All labels",
  only: "Only",
  hide: "Hide",
};

export const ALL_PROVIDERS = "__all__";

/** Labels are kept by slug, so the default works before Labels Pro answers. */
export type WidgetFilters = {
  status: StatusFilter;
  providerId: string;
  labelMode: LabelMode;
  labelSlug: string;
  sort: WidgetSort;
};

export const DEFAULT_FILTERS: WidgetFilters = {
  status: "all",
  providerId: ALL_PROVIDERS,
  labelMode: "hide",
  labelSlug: "automation",
  sort: "needs_you_first",
};

const STORAGE_KEY = "bb-plugin-thread-widget:filters:v1";

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseFilters(raw: string | null): WidgetFilters {
  if (!raw) return { ...DEFAULT_FILTERS };
  try {
    const record = JSON.parse(raw) as Record<string, unknown>;
    return {
      status: pick(record.status, STATUS_FILTERS, DEFAULT_FILTERS.status),
      providerId: typeof record.providerId === "string" ? record.providerId : DEFAULT_FILTERS.providerId,
      labelMode: pick(record.labelMode, LABEL_MODES, DEFAULT_FILTERS.labelMode),
      labelSlug: typeof record.labelSlug === "string" ? record.labelSlug : DEFAULT_FILTERS.labelSlug,
      sort: pick(record.sort, SORTS, DEFAULT_FILTERS.sort),
    };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function loadFilters(): WidgetFilters {
  try {
    return parseFilters(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function saveFilters(filters: WidgetFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Private mode or a full store: the filters still apply for this session.
  }
}

const WORKING = new Set([
  "working-draft",
  "workflow",
  "background-agent",
  "background-command",
  "plan-mode",
  "goal",
  "runtime",
]);

export function matchesStatus(thread: WidgetThread, status: StatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "needs_you":
      return (
        thread.hasPendingInteraction ||
        thread.indicator === "waiting-for-input" ||
        thread.indicator === "unread-error"
      );
    case "working":
      return WORKING.has(thread.indicator);
    case "unread":
      return thread.isUnread || thread.indicator === "unread-success";
    case "idle":
      return thread.indicator === "none" && !thread.isUnread;
    case "draft":
      return thread.indicator === "draft";
  }
}

export type SortableThread = WidgetThread & { createdAt?: number; latestAttentionAt?: number };

function compare<T extends SortableThread>(sort: WidgetSort): (a: T, b: T) => number {
  const tie = (a: T, b: T) => a.id.localeCompare(b.id);
  switch (sort) {
    case "needs_you_first":
      return (a, b) =>
        Number(needsReply(b)) - Number(needsReply(a)) || b.updatedAt - a.updatedAt || tie(a, b);
    case "attention_desc":
      return (a, b) => (b.latestAttentionAt ?? 0) - (a.latestAttentionAt ?? 0) || tie(a, b);
    case "updated_desc":
      return (a, b) => b.updatedAt - a.updatedAt || tie(a, b);
    case "created_desc":
      return (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || tie(a, b);
    case "title_asc":
      return (a, b) => threadTitle(a).localeCompare(threadTitle(b)) || tie(a, b);
  }
}

/**
 * Active threads after the widget filters. `labelIdsByThreadId` is null until
 * Labels Pro answers; the label filter waits for it.
 */
export function filterThreads<T extends SortableThread>(
  threads: readonly T[],
  filters: WidgetFilters,
  labelId: string | null,
  labelIdsByThreadId: ReadonlyMap<string, readonly string[]> | null,
  limit = 40,
): T[] {
  const useLabel = filters.labelMode !== "all" && labelId !== null && labelIdsByThreadId !== null;
  return threads
    .filter((thread) => !thread.isArchived)
    .filter((thread) => matchesStatus(thread, filters.status))
    .filter((thread) => filters.providerId === ALL_PROVIDERS || thread.providerId === filters.providerId)
    .filter((thread) => {
      if (!useLabel) return true;
      const hit = (labelIdsByThreadId.get(thread.id) ?? []).includes(labelId);
      return filters.labelMode === "hide" ? !hit : hit;
    })
    .sort(compare<T>(filters.sort))
    .slice(0, limit);
}

export type PinnableThread = SortableThread & { isPinned?: boolean; pinSortKey?: string | null };

/** A thread that is working, needs you, or is unread. */
export function isActive(thread: WidgetThread): boolean {
  return statusLabel(thread) !== "Idle";
}

/**
 * Split pinned threads. Active ones join the main list; the idle rest stay
 * in the collapsed Pinned section.
 */
export function splitPinned<T extends PinnableThread>(threads: readonly T[]): { listed: T[]; tucked: T[] } {
  const listed = threads.filter((thread) => thread.isPinned !== true || isActive(thread));
  const tucked = pinnedThreads(threads).filter((thread) => !isActive(thread));
  return { listed, tucked };
}

/** Pinned, unarchived threads in bb's pin order. Filters do not apply. */
export function pinnedThreads<T extends PinnableThread>(threads: readonly T[]): T[] {
  return threads
    .filter((thread) => thread.isPinned === true && !thread.isArchived)
    .sort((a, b) => {
      const left = a.pinSortKey ?? null;
      const right = b.pinSortKey ?? null;
      if (left !== right) {
        if (left === null) return 1;
        if (right === null) return -1;
        return left < right ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });
}

const PINNED_OPEN_KEY = "bb-plugin-thread-widget:pinned-open";

export function loadPinnedOpen(): boolean {
  try {
    return localStorage.getItem(PINNED_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePinnedOpen(open: boolean): void {
  try {
    localStorage.setItem(PINNED_OPEN_KEY, open ? "1" : "0");
  } catch {
    // The accordion still works for this session.
  }
}
