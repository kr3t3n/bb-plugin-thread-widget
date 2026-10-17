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

/** One question in the widget's question form. */
export type WidgetQuestion = {
  id: string;
  prompt: string;
  multiSelect: boolean;
  allowFreeText: boolean;
  options: { value: string; label: string; description: string | null }[];
};

export type QuestionAnswer = { selected: string[]; freeText?: string };

/**
 * The request as questions, or null when it is not a question form. Codex
 * questions get the same ids and option values that bb's Codex form uses,
 * so the server reads the answers the same way.
 */
export function questionRequest(request: PluginRequest): WidgetQuestion[] | null {
  const data = request.data as { questions?: unknown } | null;
  if (data === null || typeof data !== "object" || !Array.isArray(data.questions) || data.questions.length === 0) {
    return null;
  }
  if (request.pluginId === "provider-codex" && request.rendererId === "async-question") {
    const questions: WidgetQuestion[] = [];
    for (const [index, row] of (data.questions as { title?: unknown; options?: unknown }[]).entries()) {
      if (typeof row?.title !== "string" || row.title.trim().length === 0) return null;
      const options = Array.isArray(row.options) ? row.options.filter((label): label is string => typeof label === "string") : [];
      questions.push({
        id: `question-${index + 1}`,
        prompt: row.title,
        multiSelect: false,
        allowFreeText: true,
        options: options.map((label, optionIndex) => ({ value: `option-${optionIndex + 1}`, label, description: null })),
      });
    }
    return questions;
  }
  if (request.pluginId === "ask-user-question" && request.rendererId === "ask-user-question") {
    const questions: WidgetQuestion[] = [];
    for (const row of data.questions as {
      id?: unknown;
      prompt?: unknown;
      multiSelect?: unknown;
      allowFreeText?: unknown;
      options?: unknown;
    }[]) {
      if (typeof row?.id !== "string" || typeof row.prompt !== "string" || !Array.isArray(row.options)) return null;
      questions.push({
        id: row.id,
        prompt: row.prompt,
        multiSelect: row.multiSelect === true,
        allowFreeText: row.allowFreeText === true,
        options: (row.options as { value?: unknown; label?: unknown; description?: unknown }[])
          .filter((option) => typeof option?.value === "string" && typeof option.label === "string")
          .map((option) => ({
            value: option.value as string,
            label: option.label as string,
            description: text(option.description),
          })),
      });
    }
    return questions;
  }
  return null;
}

/** The first question that has no answer yet, or null when all have one. */
export function unansweredQuestion(
  questions: readonly WidgetQuestion[],
  answers: Readonly<Record<string, QuestionAnswer>>,
): WidgetQuestion | null {
  return (
    questions.find((question) => {
      const answer = answers[question.id];
      return answer === undefined || (answer.selected.length === 0 && (answer.freeText ?? "").trim().length === 0);
    }) ?? null
  );
}

export function respondToQuestionRequest(
  request: PluginRequest,
  answers: Record<string, QuestionAnswer>,
): Promise<void> {
  return post(interactionUrl(request, "respond"), { value: { answers } });
}
