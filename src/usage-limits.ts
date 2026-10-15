export type UsageLimit = { resetsAt: number | null };
export type ProviderLimits = ReadonlyMap<string, UsageLimit>;
export type HostLimits = ReadonlyMap<string, ProviderLimits>;

type ThreadScope = { providerId: string; host: { id: string } | null };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function exhaustedProviders(value: unknown, now = Date.now()): ProviderLimits {
  const result = new Map<string, UsageLimit>();
  const response = record(value);
  if (response === null) return result;
  for (const [providerId, raw] of Object.entries(response)) {
    const provider = record(raw);
    if (provider?.status !== "ok" || !Array.isArray(provider.windows)) continue;
    const resets: (number | null)[] = [];
    for (const rawWindow of provider.windows) {
      const window = record(rawWindow);
      if (
        window === null ||
        typeof window.label !== "string" ||
        window.model != null ||
        /\b(fable|sonnet|opus|haiku)\b/i.test(window.label) ||
        typeof window.usedPercent !== "number" ||
        !Number.isFinite(window.usedPercent) ||
        window.usedPercent < 100 ||
        (window.resetsAt !== null && typeof window.resetsAt !== "string")
      ) continue;
      const reset = typeof window.resetsAt === "string" ? Date.parse(window.resetsAt) : NaN;
      if (Number.isFinite(reset) && reset <= now) continue;
      resets.push(Number.isFinite(reset) ? reset : null);
    }
    if (resets.length > 0) {
      result.set(providerId, {
        resetsAt: resets.some((reset) => reset === null)
          ? null
          : Math.max(...(resets as number[])),
      });
    }
  }
  return result;
}

export function usageLimitForThread(
  limits: HostLimits,
  thread: ThreadScope,
  now = Date.now(),
): UsageLimit | null {
  if (thread.host === null) return null;
  const limit = limits.get(thread.host.id)?.get(thread.providerId) ?? null;
  return limit !== null && limit.resetsAt !== null && limit.resetsAt <= now ? null : limit;
}

export function usageLimitLabel(limit: UsageLimit): string {
  if (limit.resetsAt === null) return "Usage limit reached";
  const reset = new Date(limit.resetsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `Usage limit reached. Resets ${reset}`;
}

export function expireUsageLimits(limits: HostLimits, now = Date.now()): HostLimits {
  let changed = false;
  const next = new Map<string, ProviderLimits>();
  for (const [hostId, providers] of limits) {
    const remaining = new Map([...providers].filter(([, limit]) =>
      limit.resetsAt === null || limit.resetsAt > now,
    ));
    if (remaining.size !== providers.size) changed = true;
    next.set(hostId, remaining);
  }
  return changed ? next : limits;
}

export function nextUsageReset(limits: HostLimits, now = Date.now()): number | null {
  let next: number | null = null;
  for (const providers of limits.values()) {
    for (const limit of providers.values()) {
      if (limit.resetsAt !== null && limit.resetsAt > now) {
        next = next === null ? limit.resetsAt : Math.min(next, limit.resetsAt);
      }
    }
  }
  return next;
}
