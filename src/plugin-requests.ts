import { useCallback, useEffect, useState } from "react";

/**
 * bb's embedded ThreadChat leaves out pending interactions that a plugin
 * renders, such as a secret request. Poll for them, so the widget can show
 * its own secret form or send the user to bb's full thread view.
 */
export type PluginRequest = {
  id: string;
  threadId: string;
  pluginId: string | null;
  rendererId: string | null;
  title: string | null;
  data: unknown;
};

export type SecretRequest = {
  purpose: string | null;
  path: string;
  fields: { name: string; description: string | null }[];
};

type Row = {
  id?: unknown;
  threadId?: unknown;
  origin?: { kind?: unknown; pluginId?: unknown; rendererId?: unknown };
  payload?: { kind?: unknown; title?: unknown; data?: unknown };
};

const POLL_MS = 2000;
const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Same limit as bb's secrets plugin. */
export const SECRET_VALUE_MAX_LENGTH = 16 * 1024;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

export function pluginRequests(rows: unknown): PluginRequest[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Row[])
    .filter((row) => row?.payload?.kind === "plugin" && typeof row.id === "string")
    .map((row) => ({
      id: row.id as string,
      threadId: text(row.threadId) ?? "",
      pluginId: text(row.origin?.pluginId),
      rendererId: text(row.origin?.rendererId),
      title: text(row.payload?.title),
      data: row.payload?.data,
    }));
}

export function hasPluginRequest(rows: unknown): boolean {
  return pluginRequests(rows).length > 0;
}

/** The request as a secret form, or null when it is another kind of form. */
export function secretRequest(request: PluginRequest): SecretRequest | null {
  if (request.pluginId !== "secrets" || request.rendererId !== "secret-request") return null;
  const data = request.data as {
    purpose?: unknown;
    destination?: { kind?: unknown; path?: unknown };
    fields?: unknown;
  } | null;
  if (data === null || typeof data !== "object") return null;
  if (data.destination?.kind !== "dotenv" || typeof data.destination.path !== "string") return null;
  if (!Array.isArray(data.fields) || data.fields.length === 0) return null;
  const fields: SecretRequest["fields"] = [];
  for (const field of data.fields as { name?: unknown; description?: unknown }[]) {
    if (typeof field?.name !== "string" || !SECRET_NAME.test(field.name)) return null;
    fields.push({ name: field.name, description: text(field.description) });
  }
  return { purpose: text(data.purpose), path: data.destination.path, fields };
}

/** Same rules as bb's secrets plugin: non-empty, one line, no NUL, 16 KiB at most. */
export function secretValueError(value: string): string | null {
  if (value.length === 0) return "Enter a value.";
  if (value.length > SECRET_VALUE_MAX_LENGTH) return "The value is larger than 16 KiB.";
  if (value.includes("\n") || value.includes("\r")) return "The value must be on one line.";
  if (value.includes("\0")) return "The value contains a NUL character.";
  return null;
}

function interactionUrl(request: PluginRequest, action: "respond" | "cancel"): string {
  return `/api/v1/threads/${encodeURIComponent(request.threadId)}/interactions/${encodeURIComponent(request.id)}/${action}`;
}

async function post(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? `bb answered ${response.status}.`);
  }
}

/** Send the values to bb's server, the same call bb's own form makes. */
export function respondToSecretRequest(request: PluginRequest, values: Record<string, string>): Promise<void> {
  return post(interactionUrl(request, "respond"), { value: { values } });
}

export function cancelPluginRequest(request: PluginRequest): Promise<void> {
  return post(interactionUrl(request, "cancel"), {});
}

/** The open thread's plugin requests. `refresh` checks again at once. */
export function usePluginRequests(threadId: string | null): { requests: PluginRequest[]; refresh: () => void } {
  const [requests, setRequests] = useState<PluginRequest[]>([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    setRequests([]);
    if (threadId === null) return;
    const controller = new AbortController();
    const check = () => {
      void fetch(`/api/v1/threads/${encodeURIComponent(threadId)}/interactions`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : []))
        .then((rows) => {
          if (controller.signal.aborted) return;
          const next = pluginRequests(rows);
          // Keep the same array while nothing changed, so an open form keeps its state.
          setRequests((current) =>
            current.length === next.length && current.every((row, index) => row.id === next[index]?.id)
              ? current
              : next,
          );
        })
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [threadId, tick]);
  return { requests, refresh };
}
