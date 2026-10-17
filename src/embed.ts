/**
 * bb Chrome Bridge shows bb in a Chrome side panel: an extension page frames
 * bb with `?widget=1`. In that frame the widget turns on by itself, never
 * resizes the window, and tells the panel which thread is open, so the
 * panel's Share this tab button knows where to send the tab.
 */
export const EMBED_PARAM = "widget";
const MESSAGE_TYPE = "bb-thread-widget:open-thread";

/** The extension origin that frames bb, or null outside a Chrome side panel. */
export function chromeParentOrigin(): string | null {
  if (window.top === window) return null;
  const origins = window.location.ancestorOrigins;
  const parent = origins && origins.length > 0 ? origins[0] : "";
  return parent.startsWith("chrome-extension://") ? parent : null;
}

export function framed(): boolean {
  return window.top !== window;
}

/** True when the page was opened with `?widget=1`. */
export function widgetRequestedByUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get(EMBED_PARAM) === "1";
  } catch {
    return false;
  }
}

/** Tell the side panel which thread is open. Only an extension parent hears it. */
export function postOpenThread(threadId: string | null, title: string | null): void {
  const parent = chromeParentOrigin();
  if (parent === null) return;
  window.parent.postMessage({ type: MESSAGE_TYPE, threadId, title }, parent);
}
