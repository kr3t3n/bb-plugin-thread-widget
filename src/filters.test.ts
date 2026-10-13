import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FILTERS, filterThreads, parseFilters, pinnedThreads, type SortableThread } from "./filters.ts";

function thread(patch: Partial<SortableThread> & Pick<SortableThread, "id">): SortableThread {
  return {
    title: patch.id,
    titleFallback: null,
    providerId: "cursor",
    hasPendingInteraction: false,
    indicator: "none",
    isUnread: false,
    isArchived: false,
    updatedAt: 1,
    ...patch,
  };
}

const labels = new Map([["auto", ["lbl_auto"]]]);

test("the default hides automation threads once labels load", () => {
  const rows = [thread({ id: "auto" }), thread({ id: "mine" })];
  assert.equal(DEFAULT_FILTERS.labelMode, "hide");
  assert.equal(DEFAULT_FILTERS.labelSlug, "automation");
  assert.deepEqual(filterThreads(rows, DEFAULT_FILTERS, "lbl_auto", labels).map((r) => r.id), ["mine"]);
  // Before Labels Pro answers, nothing is hidden.
  assert.equal(filterThreads(rows, DEFAULT_FILTERS, null, null).length, 2);
});

test("status, provider and sort apply together", () => {
  const rows = [
    thread({ id: "a", providerId: "codex", indicator: "runtime", createdAt: 1 }),
    thread({ id: "b", providerId: "codex", indicator: "runtime", createdAt: 5 }),
    thread({ id: "c", providerId: "cursor", indicator: "runtime", createdAt: 9 }),
    thread({ id: "d", providerId: "codex", indicator: "none", createdAt: 9 }),
  ];
  const filters = { ...DEFAULT_FILTERS, labelMode: "all" as const, status: "working" as const, providerId: "codex", sort: "created_desc" as const };
  assert.deepEqual(filterThreads(rows, filters, null, null).map((r) => r.id), ["b", "a"]);
});

test("stored filters fall back to defaults for unknown values", () => {
  const parsed = parseFilters(JSON.stringify({ status: "bogus", sort: "title_asc", labelMode: "only" }));
  assert.equal(parsed.status, "all");
  assert.equal(parsed.sort, "title_asc");
  assert.equal(parsed.labelMode, "only");
  assert.deepEqual(parseFilters("not json"), DEFAULT_FILTERS);
});

test("pinned threads keep bb's pin order and skip archived ones", () => {
  const rows = [
    { ...thread({ id: "b" }), isPinned: true, pinSortKey: "b" },
    { ...thread({ id: "a" }), isPinned: true, pinSortKey: "a" },
    { ...thread({ id: "x" }), isPinned: true, pinSortKey: null },
    { ...thread({ id: "gone", isArchived: true }), isPinned: true, pinSortKey: "0" },
    { ...thread({ id: "loose" }), isPinned: false, pinSortKey: null },
  ];
  assert.deepEqual(pinnedThreads(rows).map((r) => r.id), ["a", "b", "x"]);
});
