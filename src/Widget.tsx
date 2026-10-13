import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ThreadChat,
  experimental_useProviders,
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreads,
  useRpc,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { needsReply, threadTitle } from "./inbox";
import {
  ALL_PROVIDERS,
  LABEL_MODES,
  LABEL_MODE_LABELS,
  SORTS,
  SORT_LABELS,
  STATUS_FILTERS,
  STATUS_LABELS,
  DEFAULT_FILTERS,
  filterThreads,
  loadFilters,
  loadPinnedOpen,
  pinnedThreads,
  savePinnedOpen,
  visiblePinned,
  saveFilters,
  type LabelMode,
  type StatusFilter,
  type WidgetFilters,
  type WidgetSort,
} from "./filters";
import { useLabels, type WidgetLabel } from "./labels";
import { useChromeInset } from "./chrome-inset";
import { openSidePanel } from "./side-panel";
import { ThreadRow } from "./ThreadRow";
import { RowMenu } from "./RowMenu";
import { linkContract } from "./rpc";
import { mountChatBack } from "./chat-back";
import { refreshRail } from "./rail-layout";
import { MODE_EVENT, setWidgetEnabled, widgetEnabled } from "./mode";

function WidgetIndicators({ onUsageOpen, children }: { onUsageOpen: () => void; children?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (element && !element.hasAttribute("data-thread-widget-indicators")) {
      element.setAttribute("data-thread-widget-indicators", "");
    }
    refreshRail();
    return () => {
      // Restore the owned controls before React removes their temporary host.
      element?.removeAttribute("data-thread-widget-indicators");
      refreshRail();
    };
  }, []);
  return (
    <div
      ref={host}
      className="thread-widget-indicators"
      data-thread-widget-indicators=""
      role="group"
      aria-label="Usage limits and health"
      onClick={(event) => {
        // Let the delegated meter handler navigate before removing the header.
        if (event.target instanceof Element && event.target.closest(".meter")) {
          window.setTimeout(onUsageOpen, 0);
        }
      }}
    >
      {children}
    </div>
  );
}

type ProviderOption = { id: string; displayName?: string };

const FILTER_ICON =
  "M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z";

/** True when the filters differ from the defaults, so the button can say so. */
function filtersChanged(filters: WidgetFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof WidgetFilters)[]).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  );
}

function WidgetFilterModal({
  filters,
  onChange,
  onReset,
  onClose,
  providers,
  labels,
}: {
  filters: WidgetFilters;
  onChange: (patch: Partial<WidgetFilters>) => void;
  onReset: () => void;
  onClose: () => void;
  providers: readonly ProviderOption[];
  labels: readonly WidgetLabel[] | null;
}) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.querySelector("select")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const labelOptions = labels ?? [];
  const knownSlug = labelOptions.some((label) => label.slug === filters.labelSlug);
  return (
    <div
      className="thread-widget-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={card}
        className="thread-widget-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Filter and sort threads"
      >
        <strong>Filter and sort</strong>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as StatusFilter })}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Provider</span>
          <select value={filters.providerId} onChange={(event) => onChange({ providerId: event.target.value })}>
            <option value={ALL_PROVIDERS}>All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName ?? provider.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Labels</span>
          <select
            value={filters.labelMode}
            onChange={(event) => onChange({ labelMode: event.target.value as LabelMode })}
          >
            {LABEL_MODES.map((value) => (
              <option key={value} value={value}>
                {LABEL_MODE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        {filters.labelMode === "all" ? null : (
          <label>
            <span>Label</span>
            <select value={filters.labelSlug} onChange={(event) => onChange({ labelSlug: event.target.value })}>
              {knownSlug ? null : <option value={filters.labelSlug}>{filters.labelSlug}</option>}
              {labelOptions.map((label) => (
                <option key={label.id} value={label.slug}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Sort</span>
          <select value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as WidgetSort })}>
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="thread-widget-modal-actions">
          <button type="button" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="is-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function Widget() {
  const [enabled, setEnabled] = useState(widgetEnabled);
  const widgetRoot = useRef<HTMLDivElement>(null);
  const chatBack = useRef<ReturnType<typeof mountChatBack> | null>(null);
  const historyThreadId = useRef<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [localOrigin, setLocalOrigin] = useState("http://127.0.0.1:38886");
  const rpc = useRpc<typeof linkContract>();
  const [focusRequest, setFocusRequest] = useState(0);
  const { status, threads, projects } = experimental_useSidebarThreads();
  const { providers } = experimental_useProviders();
  const actions = experimental_useSidebarThreadActions();
  const [filters, setFilters] = useState<WidgetFilters>(loadFilters);
  const labels = useLabels(enabled);
  const header = useRef<HTMLElement>(null);
  const inset = useChromeInset(header, enabled);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelMode, setPanelMode] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(loadPinnedOpen);
  const panelRun = useRef<AbortController | null>(null);
  useEffect(() => () => panelRun.current?.abort(), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const updateFilters = (patch: Partial<WidgetFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      saveFilters(next);
      return next;
    });
  };

  useEffect(() => {
    const sync = () => setEnabled(widgetEnabled());
    window.addEventListener(MODE_EVENT, sync);
    return () => window.removeEventListener(MODE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    void rpc
      .call("linkOrigins", {})
      .then((result) => {
        if (!cancel && result.localOrigin) setLocalOrigin(result.localOrigin);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [enabled, rpc]);

  useEffect(() => {
    if (openId === null) return;
    setFocusRequest((value) => value + 1);
  }, [openId]);

  useEffect(() => {
    if (!enabled) return;
    // Keep history listeners alive in the list so Forward can reopen the chat.
    return () => {
      chatBack.current?.dispose();
      chatBack.current = null;
      historyThreadId.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || openId === null || widgetRoot.current === null) return;
    if (historyThreadId.current === openId) return;
    chatBack.current?.dispose();
    chatBack.current = mountChatBack(
      widgetRoot.current,
      () => setOpenId(null),
      () => setOpenId(openId),
    );
    historyThreadId.current = openId;
  }, [enabled, openId]);

  if (!enabled) return null;

  const labelId = labels?.labels.find((label) => label.slug === filters.labelSlug)?.id ?? null;
  // Pinned threads live in the Pinned section above the divider. Collapsed,
  // it still shows the ones that are working, need you, or are unread.
  const pinned = pinnedThreads(threads);
  const shownPinned = visiblePinned(pinned, pinnedOpen);
  const rows = filterThreads(
    threads.filter((thread) => !thread.isPinned),
    filters,
    labelId,
    labels?.labelIdsByThreadId ?? null,
  );
  const waiting = rows.filter(needsReply).length + pinned.filter(needsReply).length;
  const open = threads.find((thread) => thread.id === openId) ?? null;
  const menuThread = menu === null ? null : (threads.find((thread) => thread.id === menu.id) ?? null);

  const openThread = (id: string) => {
    if (historyThreadId.current === id && chatBack.current?.forward()) return;
    historyThreadId.current = null;
    setOpenId(id);
  };

  const goBack = () => {
    if (chatBack.current) chatBack.current.back();
    else setOpenId(null);
  };

  const closeWidget = () => {
    setOpenId(null);
    setWidgetEnabled(false);
  };

  /**
   * Show bb's right panel for the open thread. The widget steps aside and
   * floats a Back to widget button over bb until the user returns.
   */
  const showSidePanel = (threadId: string, newTab: boolean) => {
    panelRun.current?.abort();
    const run = new AbortController();
    panelRun.current = run;
    actions.open(threadId);
    setPanelMode(true);
    void openSidePanel(threadId, newTab, run.signal).then((opened) => {
      if (!opened && panelRun.current === run) {
        panelRun.current = null;
        setPanelMode(false);
      }
    });
  };

  const returnToWidget = () => {
    panelRun.current?.abort();
    panelRun.current = null;
    setPanelMode(false);
  };

  const openInBb = (threadId: string) => {
    actions.open(threadId);
    closeWidget();
  };

  const renderRow = (thread: (typeof threads)[number]) => {
    if (renamingId === thread.id) {
      return (
        <form
          key={thread.id}
          className="thread-widget-row"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const title = String(data.get("title") ?? "").trim();
            setRenamingId(null);
            if (title.length > 0) void actions.rename(thread.id, title);
          }}
        >
          <input name="title" defaultValue={threadTitle(thread)} autoFocus aria-label="Thread title" />
        </form>
      );
    }
    return (
      <ThreadRow
        key={thread.id}
        thread={thread as PluginSidebarThread}
        providers={providers}
        onOpen={() => openThread(thread.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ id: thread.id, x: event.clientX, y: event.clientY });
        }}
      />
    );
  };

  return (
    <div
      ref={widgetRoot}
      className={panelMode ? "thread-widget is-stepped-aside" : "thread-widget"}
      role="dialog"
      aria-label="Thread widget"
    >
      <header
        ref={header}
        className="thread-widget-header"
        style={{ ["--thread-widget-inset" as string]: `${inset}px` }}
      >
        {open === null ? (
          <div className="thread-widget-bar">
            <div>
              <strong>Threads</strong>
              <span>{waiting === 0 ? "None waiting" : `${waiting} waiting`}</span>
            </div>
            <button
              type="button"
              className={filtersChanged(filters) ? "thread-widget-icon is-active" : "thread-widget-icon"}
              aria-label="Filter and sort"
              title="Filter and sort"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={FILTER_ICON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" onClick={closeWidget}>
              Exit
            </button>
          </div>
        ) : (
          <div className="thread-widget-bar">
            <button type="button" className="thread-widget-icon" aria-label="Back" title="Back" onClick={goBack}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <strong>{threadTitle(open)}</strong>
            <button type="button" onClick={() => openInBb(open.id)}>
              Open in bb
            </button>
          </div>
        )}
        <WidgetIndicators onUsageOpen={closeWidget}>
          {open === null ? null : (
            <div className="thread-widget-panel-actions">
              <button
                type="button"
                className="thread-widget-icon"
                aria-label="Show right panel"
                title="Show right panel"
                onClick={() => showSidePanel(open.id, false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M14.5 4.5v15" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                type="button"
                className="thread-widget-icon"
                aria-label="Open new tab"
                title="Open new tab (terminal, files and more)"
                onClick={() => showSidePanel(open.id, true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </WidgetIndicators>
      </header>
      {open === null ? (
        <>
          <p className="thread-widget-note">
            Resize this window to keep the list small. A reply uses the thread composer, including files.
          </p>
          <div className="thread-widget-list">
            {status === "loading" && rows.length === 0 ? <p>Loading threads.</p> : null}
            {status === "error" ? <p>The thread list is unavailable.</p> : null}
            {status === "ready" && rows.length === 0 && pinned.length === 0 ? <p>No active threads.</p> : null}
            {pinned.length > 0 ? (
              <section className="thread-widget-pinned">
                <button
                  type="button"
                  className="thread-widget-pinned-toggle"
                  aria-expanded={pinnedOpen}
                  onClick={() => {
                    setPinnedOpen(!pinnedOpen);
                    savePinnedOpen(!pinnedOpen);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Pinned</span>
                  <span className="thread-widget-pinned-count">{pinned.length}</span>
                </button>
                {shownPinned.map(renderRow)}
              </section>
            ) : null}
            {rows.map(renderRow)}
          </div>
          {menu !== null && menuThread !== null ? (
            <RowMenu
              thread={menuThread as PluginSidebarThread}
              personal={projects.find((project) => project.id === menuThread.projectId)?.isPersonal === true}
              x={menu.x}
              y={menu.y}
              localOrigin={localOrigin}
              onClose={() => setMenu(null)}
              onOpenSplit={() => {
                actions.open(menuThread.id, { split: true });
                setMenu(null);
                closeWidget();
              }}
              onRename={() => {
                setMenu(null);
                window.setTimeout(() => setRenamingId(menuThread.id), 0);
              }}
              onRead={() => {
                void actions.setRead(menuThread.id, menuThread.isUnread);
                setMenu(null);
              }}
              onPin={() => {
                void actions.setPinned(menuThread.id, !menuThread.isPinned);
                setMenu(null);
              }}
              onArchive={() => {
                actions.archive(menuThread.id);
                setMenu(null);
              }}
              onDelete={() => {
                actions.requestDelete(menuThread.id);
                setMenu(null);
              }}
            />
          ) : null}
        </>
      ) : (
        <div
          className="thread-widget-chat"
          onSubmit={() => {
            window.setTimeout(goBack, 0);
          }}
        >
          <div className="thread-widget-transcript">
            <ThreadChat
              threadId={open.id}
              variant="compact"
              layout="contained"
              focusRequest={focusRequest}
            />
          </div>
        </div>
      )}
      {panelMode ? (
        <button type="button" className="thread-widget-return" onClick={returnToWidget}>
          Back to widget
        </button>
      ) : null}
      {filtersOpen && open === null ? (
        <WidgetFilterModal
          filters={filters}
          onChange={updateFilters}
          onReset={() => updateFilters(DEFAULT_FILTERS)}
          onClose={closeFilters}
          providers={providers}
          labels={labels?.labels ?? null}
        />
      ) : null}
    </div>
  );
}
