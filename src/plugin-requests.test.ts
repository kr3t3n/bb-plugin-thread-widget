import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPluginRequest, pluginRequests, secretRequest, secretValueError } from "./plugin-requests.ts";

const secretRow = {
  id: "pint_1",
  threadId: "thr_1",
  origin: { kind: "plugin", pluginId: "secrets", rendererId: "secret-request" },
  payload: {
    kind: "plugin",
    title: "Add secrets",
    data: {
      purpose: "Configure the app",
      destination: { kind: "dotenv", path: "/tmp/.env" },
      fields: [{ name: "API_KEY", description: "The API key" }],
    },
  },
};

test("only plugin-rendered requests count", () => {
  assert.equal(hasPluginRequest([secretRow]), true);
  assert.equal(hasPluginRequest([{ id: "q", payload: { kind: "question" } }]), false);
  assert.equal(hasPluginRequest([]), false);
  assert.equal(hasPluginRequest({ error: "x" }), false);
});

test("a secrets request becomes a form; other plugin forms do not", () => {
  const [request] = pluginRequests([secretRow]);
  assert.deepEqual(secretRequest(request!), {
    purpose: "Configure the app",
    path: "/tmp/.env",
    fields: [{ name: "API_KEY", description: "The API key" }],
  });
  const other = { ...secretRow, origin: { kind: "plugin", pluginId: "other", rendererId: "x" } };
  assert.equal(secretRequest(pluginRequests([other])[0]!), null);
  const badName = { ...secretRow, payload: { ...secretRow.payload, data: { ...secretRow.payload.data, fields: [{ name: "1X" }] } } };
  assert.equal(secretRequest(pluginRequests([badName])[0]!), null);
});

test("secret values follow the secrets plugin rules", () => {
  assert.equal(secretValueError("abc"), null);
  assert.notEqual(secretValueError(""), null);
  assert.notEqual(secretValueError("a\nb"), null);
  assert.notEqual(secretValueError("a\0b"), null);
  assert.notEqual(secretValueError("x".repeat(16 * 1024 + 1)), null);
});
