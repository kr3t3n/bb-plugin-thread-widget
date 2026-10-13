import { useEffect, useState } from "react";

export type WidgetLabel = { id: string; name: string; slug: string };
export type LabelsSnapshot = {
  labels: WidgetLabel[];
  labelIdsByThreadId: Map<string, string[]>;
};

type AssignmentsResult = {
  revision: number;
  changed: boolean;
  labels: WidgetLabel[] | null;
  assignments: { labelId: string; threadIds: string[] }[] | null;
};

const POLL_MS = 15_000;

async function listAssignments(sinceRevision: number | null): Promise<AssignmentsResult | null> {
  const response = await fetch("/api/v1/plugins/labels-pro/rpc/listAssignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sinceRevision === null ? {} : { sinceRevision }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { ok?: boolean; result?: AssignmentsResult };
  return data.ok === true && data.result ? data.result : null;
}

/** Labels Pro labels and assignments, polled while the widget is open. */
export function useLabels(enabled: boolean): LabelsSnapshot | null {
  const [snapshot, setSnapshot] = useState<LabelsSnapshot | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    let revision: number | null = null;
    const load = async () => {
      try {
        const result = await listAssignments(revision);
        if (cancel || result === null) return;
        revision = result.revision;
        if (!result.changed || result.labels === null || result.assignments === null) return;
        const map = new Map<string, string[]>();
        for (const { labelId, threadIds } of result.assignments) {
          for (const threadId of threadIds) {
            const ids = map.get(threadId);
            if (ids) ids.push(labelId);
            else map.set(threadId, [labelId]);
          }
        }
        setSnapshot({ labels: result.labels, labelIdsByThreadId: map });
      } catch {
        // Labels Pro is optional. Keep the last snapshot.
      }
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return snapshot;
}
