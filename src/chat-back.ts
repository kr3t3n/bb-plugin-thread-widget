const HISTORY_KEY = "bbThreadWidgetChat";
const CLEANUP_KEY = Symbol.for("bb.thread-widget.chat-back-cleanup");
type Cleanup = { token: string; timer: number };
const EDGE_PX = 40;
const SWIPE_PX = 72;
const INTENT_PX = 12;
const MAX_SWIPE_MS = 800;

/** One same-page history entry supports Back and Forward in widget mode. */
export function mountChatBack(root: HTMLElement, onBack: () => void, onForward: () => void = () => {}) {
  const win = root.ownerDocument.defaultView!;
  const host = win as unknown as Record<symbol, Cleanup | undefined>;
  const cleanup = host[CLEANUP_KEY];
  const reuse = cleanup && win.history.state?.[HISTORY_KEY] === cleanup.token;
  if (cleanup) {
    win.clearTimeout(cleanup.timer);
    delete host[CLEANUP_KEY];
  }
  const token = reuse ? cleanup.token : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const url = win.location.href;
  const previous = win.history.state;
  const state = previous && typeof previous === "object" ? previous : {};
  let pending = false;
  let inChat = true;
  let returnedToList = false;
  let disposed = false;
  let swipe: { id: number; x: number; y: number; at: number; direction: 1 | -1 } | null = null;

  const ownsEntry = () => win.history.state?.[HISTORY_KEY] === token && win.location.href === url;
  const back = () => {
    if (pending || !inChat || disposed) return;
    if (ownsEntry()) {
      pending = true;
      win.history.back();
    } else {
      inChat = false;
      returnedToList = win.location.href === url;
      onBack();
    }
  };
  const forward = () => {
    if (pending || inChat || disposed || !returnedToList || win.location.href !== url) return false;
    pending = true;
    win.history.forward();
    return true;
  };
  const onPop = () => {
    if (disposed) return;
    pending = false;
    swipe = null;
    if (ownsEntry()) {
      if (!inChat) { inChat = true; returnedToList = false; onForward(); }
    } else {
      returnedToList = win.location.href === url;
      if (inChat) { inChat = false; onBack(); }
    }
  };

  win.addEventListener("popstate", onPop);
  if (!reuse) win.history.pushState({
    ...state,
    ...(typeof state.idx === "number" ? { idx: state.idx + 1 } : {}),
    [HISTORY_KEY]: token,
  }, "", url);

  const onStart = (event: TouchEvent) => {
    swipe = null;
    if (event.touches.length !== 1) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(
      'input, textarea, select, [contenteditable], [role="slider"], pre, code',
    )) return;
    const selection = win.getSelection();
    if (selection && !selection.isCollapsed) return;
    const touch = event.touches[0];
    const rect = root.getBoundingClientRect();
    let direction: 1 | -1;
    if (inChat && touch.clientX - rect.left <= EDGE_PX) direction = 1;
    else if (!inChat && returnedToList && rect.right - touch.clientX <= EDGE_PX) direction = -1;
    else return;
    swipe = { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: Date.now(), direction };
  };
  const onMove = (event: TouchEvent) => {
    if (swipe === null) return;
    if (event.touches.length !== 1 || Date.now() - swipe.at > MAX_SWIPE_MS) {
      swipe = null;
      return;
    }
    const touch = event.touches[0];
    if (touch.identifier !== swipe.id) { swipe = null; return; }
    const dx = (touch.clientX - swipe.x) * swipe.direction;
    const dy = Math.abs(touch.clientY - swipe.y);
    if (dx < -INTENT_PX || (dy > INTENT_PX && dy * 2 >= dx)) {
      swipe = null;
      return;
    }
    if (dx < INTENT_PX || dx <= dy * 2) return;
    // Claim only a deliberate horizontal gesture, before the browser scrolls.
    if (event.cancelable) event.preventDefault();
    if (dx >= SWIPE_PX) {
      const direction = swipe.direction;
      swipe = null;
      if (direction === 1) back();
      else forward();
    }
  };
  const onEnd = () => { swipe = null; };
  root.addEventListener("touchstart", onStart, { passive: true });
  root.addEventListener("touchmove", onMove, { passive: false });
  root.addEventListener("touchend", onEnd);
  root.addEventListener("touchcancel", onEnd);

  return {
    back,
    forward,
    dispose() {
      if (disposed) return;
      disposed = true;
      swipe = null;
      win.removeEventListener("popstate", onPop);
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
      // Manual close/submit also consumes this entry, without undoing routing.
      if (!pending && ownsEntry()) {
        // StrictMode can immediately remount; let it adopt this entry first.
        const timer = win.setTimeout(() => {
          if (host[CLEANUP_KEY]?.token !== token) return;
          delete host[CLEANUP_KEY];
          if (ownsEntry()) win.history.back();
        }, 0);
        host[CLEANUP_KEY] = { token, timer };
      }
    },
  };
}
