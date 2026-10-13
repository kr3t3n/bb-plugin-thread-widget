/** Window width in widget mode. bb sets no minimum, so pick the smallest usable one. */
export const WIDGET_WIDTH = 360;
const SAVED_KEY = "bb-plugin-thread-widget:restore-width";

type Desktop = { getWindowState?: () => Promise<{ isFullScreen?: boolean } | null> | { isFullScreen?: boolean } | null };

function desktop(): Desktop | null {
  return (window as unknown as { bbDesktop?: Desktop }).bbDesktop ?? null;
}

async function canResize(): Promise<boolean> {
  const api = desktop();
  // A browser tab cannot resize itself. Only the desktop window can.
  if (api === null) return false;
  try {
    const state = await api.getWindowState?.();
    return state?.isFullScreen !== true;
  } catch {
    return true;
  }
}

/** Remember the current width, then shrink the window to the widget width. */
export async function shrinkWindow(): Promise<void> {
  if (!(await canResize())) return;
  const width = window.outerWidth;
  if (width > WIDGET_WIDTH) {
    try {
      localStorage.setItem(SAVED_KEY, String(width));
    } catch {
      // Without storage, Exit cannot restore the width. Still shrink.
    }
  }
  window.resizeTo(WIDGET_WIDTH, window.outerHeight);
}

/** Put the window back to the width it had before widget mode. */
export async function restoreWindow(): Promise<void> {
  let saved: number | null = null;
  try {
    saved = Number(localStorage.getItem(SAVED_KEY)) || null;
    localStorage.removeItem(SAVED_KEY);
  } catch {
    saved = null;
  }
  if (saved === null || !(await canResize())) return;
  window.resizeTo(saved, window.outerHeight);
}
