import {
  experimental_ProviderIcon as ProviderIcon,
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
  useSidebarThreadRowStatus,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { needsReply, statusLabel, threadTitle } from "./inbox";
import type { UsageLimit } from "./usage-limits";
import { UsageLimitBadge } from "./UsageLimitBadge";

type AgentProvider = {
  id: string;
  displayName?: string;
  logoUrl?: string | null;
  icon?: { glyph?: string } | string | null;
};

export function ThreadRow({
  thread,
  providers,
  usageLimit,
  onOpen,
  onContextMenu,
}: {
  thread: PluginSidebarThread;
  providers: readonly AgentProvider[];
  usageLimit: UsageLimit | null;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
}) {
  const rowStatus = useSidebarThreadRowStatus(thread.id);
  const provider = providers.find((entry) => entry.id === thread.providerId) ?? {
    id: thread.providerId,
  };
  const label = statusLabel(thread);

  return (
    <div
      data-thread-widget-row=""
      className={needsReply(thread) ? "thread-widget-row is-waiting" : "thread-widget-row"}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="thread-widget-open"
        aria-label={`${threadTitle(thread)}. ${label}`}
        onClick={onOpen}
      />
      <span className="thread-widget-provider-group">
        <ProviderIcon
          providerKind="agent"
          provider={provider}
          className="thread-widget-provider"
          aria-label={provider.displayName ?? thread.providerId}
        />
        {usageLimit === null ? null : <UsageLimitBadge limit={usageLimit} />}
      </span>
      <span className="thread-widget-title">{threadTitle(thread)}</span>
      <span className="thread-widget-marks">
        <ThreadStatusGlyph indicator={thread.indicator} rowStatus={rowStatus} />
        <span className={`thread-widget-status is-${label.replace(" ", "-").toLowerCase()}`}>{label}</span>
      </span>
    </div>
  );
}
