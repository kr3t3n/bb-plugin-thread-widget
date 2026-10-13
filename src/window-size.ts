/** Window width in widget mode: the narrowest width where the header fits. */
export const WIDGET_WIDTH = 360;
const SAVED_KEY = "bb-plugin-thread-widget:restore-width";

type WidthResult = { previousWidth: number; width: number } | null;
type Desktop = { setWindowWidth?: (width: number) => Promise<WidthResult> };

/**
 * gap-bb's desktop bridge can set the window width. The official app has no
 * such call, so on it the widget leaves the window as it is.
 */
function setWindowWidth(): ((width: number) => Promise<WidthResult>) | null {
  const api = (window as unknown as { bbDesktop?: Desktop }).bbDesktop;
  return api?.setWindowWidth?.bind(api) ?? null;
}

export async function shrinkWindow(): Promise<void> {
  const set = setWindowWidth();
  if (set === null) return;
  try {
    const result = await set(WIDGET_WIDTH);
    if (result !== null && result.previousWidth > WIDGET_WIDTH) {
      localStorage.setItem(SAVED_KEY, String(result.previousWidth));
    }
  } catch {
    // A failed resize leaves the window as it was.
  }
}

export async function restoreWindow(): Promise<void> {
  const set = setWindowWidth();
  let saved: number | null = null;
  try {
    saved = Number(localStorage.getItem(SAVED_KEY)) || null;
    localStorage.removeItem(SAVED_KEY);
  } catch {
    saved = null;
  }
  if (set === null || saved === null) return;
  try {
    await set(saved);
  } catch {
    // Keep the current width.
  }
}
