import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPluginRequest } from "./plugin-requests.ts";

test("only plugin-rendered requests count", () => {
  assert.equal(hasPluginRequest([{ payload: { kind: "plugin" } }]), true);
  assert.equal(hasPluginRequest([{ payload: { kind: "question" } }]), false);
  assert.equal(hasPluginRequest([]), false);
  assert.equal(hasPluginRequest({ error: "x" }), false);
});
