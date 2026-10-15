import { useEffect, useState } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { exhaustedProviders, expireUsageLimits, nextUsageReset, type HostLimits } from "./usage-limits";

const POLL_MS = 60_000;

export function useUsageLimits(threads: readonly PluginSidebarThread[], enabled: boolean): HostLimits {
  const [limits, setLimits] = useState<HostLimits>(() => new Map());
  const hostKey = JSON.stringify([...new Set(
    threads.filter((thread) => !thread.isArchived).flatMap((thread) => thread.host ? [thread.host.id] : []),
  )].sort());

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const expire = () => {
      const now = Date.now();
      setLimits((current) => expireUsageLimits(current, now));
      const next = nextUsageReset(limits, now);
      if (next !== null) {
        timer = window.setTimeout(expire, Math.min(2_147_483_647, Math.max(1, next - now)));
      }
    };
    expire();
    return () => window.clearTimeout(timer);
  }, [enabled, limits]);

  useEffect(() => {
    if (!enabled) return;
    const hostIds = JSON.parse(hostKey) as string[];
    const active = new Map<string, AbortController>();
    let disposed = false;
    const loadHost = async (hostId: string) => {
      if (disposed || document.hidden || active.has(hostId)) return;
      const controller = new AbortController();
      active.set(hostId, controller);
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const query = new URLSearchParams({ hostId });
        const response = await fetch(`/api/v1/system/usage-limits?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Usage limits unavailable");
        const next = exhaustedProviders(await response.json());
        if (disposed || controller.signal.aborted) return;
        setLimits((current) => new Map(current).set(hostId, next));
      } catch {
        if (!disposed) setLimits((current) => new Map(current).set(hostId, new Map()));
      } finally {
        window.clearTimeout(timeout);
        active.delete(hostId);
      }
    };
    const load = () => {
      if (document.hidden) return;
      for (const hostId of hostIds) void loadHost(hostId);
    };
    setLimits((current) => new Map([...current].filter(([hostId]) => hostIds.includes(hostId))));
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      for (const controller of active.values()) controller.abort();
    };
  }, [enabled, hostKey]);

  return limits;
}
