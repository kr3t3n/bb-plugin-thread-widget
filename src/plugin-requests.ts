import { useEffect, useState } from "react";

/**
 * bb's embedded ThreadChat leaves out pending interactions that a plugin
 * renders, such as a secret request. Poll for them, so the widget can send
 * the user to bb's full thread view, which shows the form.
 */
type Interaction = { id?: string; payload?: { kind?: string } };

const POLL_MS = 2000;

export function hasPluginRequest(interactions: unknown): boolean {
  if (!Array.isArray(interactions)) return false;
  return (interactions as Interaction[]).some((row) => row?.payload?.kind === "plugin");
}

export async function fetchPluginRequest(threadId: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/v1/threads/${encodeURIComponent(threadId)}/interactions`, { signal });
  if (!response.ok) return false;
  return hasPluginRequest(await response.json());
}

/** True while the thread waits on a form that only bb's full view shows. */
export function usePluginRequest(threadId: string | null): boolean {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    setWaiting(false);
    if (threadId === null) return;
    const controller = new AbortController();
    const check = () => {
      void fetchPluginRequest(threadId, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setWaiting(value);
        })
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [threadId]);
  return waiting;
}
