import assert from "node:assert/strict";
import { test } from "node:test";
import { exhaustedProviders, expireUsageLimits, nextUsageReset, usageLimitForThread, usageLimitLabel } from "./usage-limits.ts";

import { usageTooltipPosition } from "./usage-tooltip.ts";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const RESET = "2026-10-15T14:00:00Z";

function window(patch: Record<string, unknown> = {}) {
  return { label: "Five-hour", usedPercent: 100, resetsAt: RESET, ...patch };
}

function provider(...windows: unknown[]) {
  return { status: "ok", windows };
}

test("requires actual finite exhaustion instead of rounded remaining usage", () => {
  const limits = exhaustedProviders({
    reached: provider(window()),
    over: provider(window({ usedPercent: 101 })),
    rounded: provider(window({ usedPercent: 99.8 })),
    invalid: provider(window({ usedPercent: Infinity })),
    string: provider(window({ usedPercent: "100" })),
  }, NOW);
  assert.deepEqual([...limits.keys()], ["reached", "over"]);
});

test("ignores expired windows, unknown statuses, and malformed responses", () => {
  assert.equal(exhaustedProviders({
    past: provider(window({ resetsAt: "2026-10-15T11:00:00Z" })),
    current: provider(window({ resetsAt: "2026-10-15T12:00:00Z" })),
    error: { status: "error", windows: [window()] },
    signedOut: { status: "unauthenticated", windows: [window()] },
    malformed: provider(null, {}, window({ resetsAt: 123 })),
  }, NOW).size, 0);
  for (const value of [null, [], "invalid", { codex: null }]) {
    assert.equal(exhaustedProviders(value, NOW).size, 0);
  }
});

test("does not mark provider-wide limits for model-specific windows", () => {
  assert.equal(exhaustedProviders({
    claude: provider(window({ label: "weekly-fable" })),
    model: provider(window({ model: "fable" })),
    emptyModel: provider(window({ model: "" })),
    namedFable: provider(window({ label: "Weekly Fable limit" })),
    namedSonnet: provider(window({ label: "Sonnet" })),
    namedOpus: provider(window({ label: "Weekly Opus" })),
    namedHaiku: provider(window({ label: "Haiku quota" })),
  }, NOW).size, 0);
  assert.equal(exhaustedProviders({
    claude: provider(window({ label: "weekly-fable" }), window({ label: "Weekly" })),
  }, NOW).size, 1);
});

test("uses the latest blocking reset and omits a reset when one is unknown", () => {
  const limits = exhaustedProviders({
    codex: provider(window(), window({ resetsAt: "2026-10-16T12:00:00Z" })),
    unknown: provider(window(), window({ resetsAt: null })),
    invalid: provider(window({ resetsAt: "unknown" })),
  }, NOW);
  assert.equal(limits.get("codex")?.resetsAt, Date.parse("2026-10-16T12:00:00Z"));
  assert.equal(limits.get("unknown")?.resetsAt, null);
  assert.equal(limits.get("invalid")?.resetsAt, null);
});

test("matches the thread host and provider and clears recovered or expired usage", () => {
  const hostLimits = new Map([
    ["one", exhaustedProviders({ codex: provider(window()) }, NOW)],
    ["two", exhaustedProviders({ codex: provider(window({ usedPercent: 5 })) }, NOW)],
  ]);
  const thread = { providerId: "codex", host: { id: "one" } };
  assert.notEqual(usageLimitForThread(hostLimits, thread, NOW), null);
  assert.equal(usageLimitForThread(hostLimits, { ...thread, host: { id: "two" } }, NOW), null);
  assert.equal(usageLimitForThread(hostLimits, { ...thread, providerId: "claude-code" }, NOW), null);
  assert.equal(usageLimitForThread(hostLimits, { ...thread, host: null }, NOW), null);
  assert.equal(usageLimitForThread(hostLimits, thread, Date.parse(RESET)), null);
  hostLimits.set("one", exhaustedProviders({ codex: provider(window({ usedPercent: 5 })) }, NOW));
  assert.equal(usageLimitForThread(hostLimits, thread, NOW), null);
});

test("exposes the full usage message and a known reset time", () => {
  assert.equal(usageLimitLabel({ resetsAt: null }), "Usage limit reached");
  assert.match(usageLimitLabel({ resetsAt: Date.parse(RESET) }), /^Usage limit reached\. Resets /);
});

test("schedules the nearest host reset and expires only elapsed known limits", () => {
  const first = Date.parse(RESET);
  const later = first + 60_000;
  const limits = new Map([
    ["one", new Map([
      ["codex", { resetsAt: first }],
      ["claude-code", { resetsAt: later }],
    ])],
    ["two", new Map([["codex", { resetsAt: null }]])],
  ]);
  assert.equal(nextUsageReset(limits, NOW), first);
  assert.equal(expireUsageLimits(limits, NOW), limits);
  const expired = expireUsageLimits(limits, first);
  assert.equal(expired.get("one")?.has("codex"), false);
  assert.equal(expired.get("one")?.has("claude-code"), true);
  assert.equal(expired.get("two")?.has("codex"), true);
  assert.equal(nextUsageReset(expired, first), later);
  assert.equal(nextUsageReset(expireUsageLimits(expired, later), later), null);
});

test("keeps reset tooltips inside narrow or short viewports", () => {
  const tooltip = { width: 288, height: 70 };
  const viewport = { width: 360, height: 400 };
  assert.deepEqual(usageTooltipPosition(
    { left: 200, top: 350, bottom: 370 }, tooltip, viewport,
  ), { left: 64, top: 274 });
  assert.deepEqual(usageTooltipPosition(
    { left: 0, top: 5, bottom: 25 }, { width: 100, height: 30 }, viewport,
  ), { left: 8, top: 31 });
  assert.deepEqual(usageTooltipPosition(
    { left: 20, top: 10, bottom: 30 }, { width: 184, height: 64 }, { width: 200, height: 80 },
  ), { left: 8, top: 8 });
});
