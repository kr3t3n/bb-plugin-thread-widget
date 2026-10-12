import assert from "node:assert/strict";
import { test } from "node:test";
import { needsReply, statusLabel, widgetThreads, type WidgetThread } from "./inbox.ts";

function thread(patch: Partial<WidgetThread> & Pick<WidgetThread, "id">): WidgetThread {
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

test("needs-you threads sort above newer idle threads", () => {
  const rows = widgetThreads([
    thread({ id: "new", updatedAt: 50 }),
    thread({ id: "old", isArchived: true, updatedAt: 99 }),
    thread({ id: "wait", hasPendingInteraction: true, updatedAt: 2 }),
    thread({ id: "unread", indicator: "unread-success", updatedAt: 3 }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["unread", "wait", "new"],
  );
});

test("status names a thread that is waiting", () => {
  assert.equal(statusLabel(thread({ id: "a", indicator: "waiting-for-input" })), "Needs you");
  assert.equal(needsReply(thread({ id: "b", indicator: "unread-success" })), true);
  assert.equal(statusLabel(thread({ id: "c", indicator: "runtime" })), "Working");
});
