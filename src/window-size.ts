/** Window width in widget mode: the narrowest width where the header fits. */
export const WIDGET_WIDTH = 360;
const SAVED_KEY = "bb-plugin-thread-widget:restore-width";

type WidthResult = { previousWidth: number; width: number } | null;
type Desktop = { setWindowWidth?: (width: number) => Promise<WidthResult> };

/** gap-bb's desktop bridge can set the window width. The official app cannot. */
function desktopSetWidth(): ((width: number) => Promise<WidthResult>) | null {
  const api = (window as unknown as { bbDesktop?: Desktop }).bbDesktop;
  return api?.setWindowWidth?.bind(api) ?? null;
}

/**
 * An installed PWA runs in its own app window, and Chromium lets an app
 * window resize itself. A normal browser tab ignores resizeTo.
 */
function isAppWindow(): boolean {
  return ["standalone", "minimal-ui", "window-controls-overlay", "fullscreen"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

/** Set the width; resolve the width the window had before. */
async function setWidth(width: number): Promise<number | null> {
  const previous = window.outerWidth;
  const desktop = desktopSetWidth();
  if (desktop !== null) {
    const result = await desktop(width);
    return result === null ? null : result.previousWidth;
  }
  if (!isAppWindow()) return null;
  window.resizeTo(width, window.outerHeight);
  return previous;
}

export async function shrinkWindow(): Promise<void> {
  try {
    const previous = await setWidth(WIDGET_WIDTH);
    if (previous !== null && previous > WIDGET_WIDTH) {
      localStorage.setItem(SAVED_KEY, String(previous));
    }
  } catch {
    // A failed resize leaves the window as it was.
  }
}

export async function restoreWindow(): Promise<void> {
  let saved: number | null = null;
  try {
    saved = Number(localStorage.getItem(SAVED_KEY)) || null;
    localStorage.removeItem(SAVED_KEY);
  } catch {
    saved = null;
  }
  if (saved === null) return;
  try {
    await setWidth(saved);
  } catch {
    // Keep the current width.
  }
}
