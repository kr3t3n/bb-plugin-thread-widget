import { useEffect, useLayoutEffect, useRef } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { copyText, threadPath, threadUrl } from "./thread-link";

export function RowMenu({
  thread,
  personal,
  x,
  y,
  localOrigin,
  onClose,
  onOpenSplit,
  onRename,
  onRead,
  onPin,
  onArchive,
  onDelete,
}: {
  thread: PluginSidebarThread;
  personal: boolean;
  x: number;
  y: number;
  localOrigin: string;
  onClose: () => void;
  onOpenSplit: () => void;
  onRename: () => void;
  onRead: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const path = threadPath(thread, { isPersonal: personal });
  const here = window.location.origin.replace(/\/$/, "");
  const cloudOrigin = here === localOrigin.replace(/\/$/, "") ? null : here;

  useLayoutEffect(() => {
    const element = menu.current;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    const left = Math.min(Math.max(8, x), window.innerWidth - rect.width - 8);
    const top = Math.min(Math.max(8, y), window.innerHeight - rect.height - 8);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menu.current !== null && event.target instanceof Node && menu.current.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const copy = (text: string) => {
    void copyText(text);
    onClose();
  };

  return (
    <div
      ref={menu}
      className="thread-widget-menu"
      role="menu"
      aria-label="Thread actions"
      style={{ left: x, top: y }}
    >
      <button type="button" role="menuitem" onClick={onOpenSplit}>
        Open in split
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => copy(thread.id)}>
        Copy thread ID
      </button>
      <button type="button" role="menuitem" onClick={() => copy(threadUrl(path, localOrigin))}>
        Copy local link
      </button>
      {cloudOrigin === null ? null : (
        <button type="button" role="menuitem" onClick={() => copy(threadUrl(path, cloudOrigin))}>
          Copy cloud link
        </button>
      )}
      <hr />
      <button type="button" role="menuitem" onClick={onRead}>
        {thread.isUnread ? "Mark read" : "Mark unread"}
      </button>
      <button type="button" role="menuitem" onClick={onPin}>
        {thread.isPinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={onArchive}>
        Archive
      </button>
      <button type="button" role="menuitem" className="is-destructive" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
