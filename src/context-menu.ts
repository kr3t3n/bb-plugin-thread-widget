const HOLD_MS = 550;
const SLOP = 10;

function editable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input, textarea, [contenteditable='true']") !== null;
}

function selectionInside(target: EventTarget | null): boolean {
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed || selection.toString().trim() === "") return false;
  if (!(target instanceof Node)) return false;
  const node = selection.anchorNode;
  return node !== null && (target === node || (target instanceof Element && target.contains(node)));
}

function clickButton(root: Element, label: string): boolean {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (button === null) return false;
  button.click();
  return true;
}

/** Opens the existing thread or message menu when the host menu did not. */
function openFallback(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const message = target.closest("[data-message-column]");
  if (message !== null) return clickButton(message, "Message actions");
  const thread = target.closest("[data-sidebar-thread-id], [data-thread-widget-row]");
  if (thread === null) return false;
  const scope = thread.closest("li, [data-thread-widget-row]") ?? thread;
  return clickButton(scope, "Thread actions");
}

export function mountContextMenus(signal: AbortSignal): void {
  let timer = 0;
  let start: { x: number; y: number; target: EventTarget | null } | null = null;

  const clear = () => {
    window.clearTimeout(timer);
    timer = 0;
    start = null;
  };

  const onContextMenu = (event: MouseEvent) => {
    if (event.defaultPrevented || editable(event.target) || selectionInside(event.target)) return;
    if (openFallback(event.target)) event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" || event.button !== 0 || editable(event.target)) return;
    clear();
    const point = { x: event.clientX, y: event.clientY, target: event.target };
    start = point;
    timer = window.setTimeout(() => {
      const target = point.target;
      clear();
      if (!(target instanceof Element)) return;
      target.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
        }),
      );
    }, HOLD_MS);
  };

  const onMove = (event: PointerEvent) => {
    if (start === null) return;
    if (Math.abs(event.clientX - start.x) > SLOP || Math.abs(event.clientY - start.y) > SLOP) clear();
  };

  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", clear);
  document.addEventListener("pointercancel", clear);
  signal.addEventListener(
    "abort",
    () => {
      clear();
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", clear);
      document.removeEventListener("pointercancel", clear);
    },
    { once: true },
  );
}
