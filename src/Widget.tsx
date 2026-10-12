import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ThreadChat,
  experimental_useProviders,
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreads,
  useRpc,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { needsReply, threadTitle, widgetThreads } from "./inbox";
import { ThreadRow } from "./ThreadRow";
import { RowMenu } from "./RowMenu";
import { linkContract } from "./rpc";
import { mountChatBack } from "./chat-back";
import { refreshRail } from "./rail-layout";
import { MODE_EVENT, setWidgetEnabled, widgetEnabled } from "./mode";

function WidgetIndicators({ onUsageOpen }: { onUsageOpen: () => void }) {
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
    />
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

  const rows = widgetThreads(threads);
  const waiting = rows.filter(needsReply).length;
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

  const openInBb = (threadId: string) => {
    actions.open(threadId);
    closeWidget();
  };

  return (
    <div ref={widgetRoot} className="thread-widget" role="dialog" aria-label="Thread widget">
      <header className="thread-widget-header">
        {open === null ? (
          <div className="thread-widget-bar">
            <div>
              <strong>Threads</strong>
              <span>{waiting === 0 ? "None waiting" : `${waiting} waiting`}</span>
            </div>
            <button type="button" onClick={closeWidget}>
              Exit
            </button>
          </div>
        ) : (
          <div className="thread-widget-bar">
            <button type="button" onClick={goBack}>
              Back
            </button>
            <strong>{threadTitle(open)}</strong>
            <button type="button" onClick={() => openInBb(open.id)}>
              Open in bb
            </button>
          </div>
        )}
        <WidgetIndicators onUsageOpen={closeWidget} />
      </header>
      {open === null ? (
        <>
          <p className="thread-widget-note">
            Resize this window to keep the list small. A reply uses the thread composer, including files.
          </p>
          <div className="thread-widget-list">
            {status === "loading" && rows.length === 0 ? <p>Loading threads.</p> : null}
            {status === "error" ? <p>The thread list is unavailable.</p> : null}
            {status === "ready" && rows.length === 0 ? <p>No active threads.</p> : null}
            {rows.map((thread) => {
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
            })}
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
    </div>
  );
}
