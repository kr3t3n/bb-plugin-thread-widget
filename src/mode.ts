import { chromeParentOrigin, widgetRequestedByUrl } from "./embed";
import { restoreWindow, shrinkWindow } from "./window-size";

export const MODE_KEY = "bb-plugin-thread-widget:enabled";
export const MODE_EVENT = "thread-widget-mode";

// `?widget=1`, or a frame inside the bb Chrome Bridge side panel, starts in
// widget mode. A sign-in redirect can drop the query, so the frame check counts too.
if (widgetRequestedByUrl() || chromeParentOrigin() !== null) {
  try {
    localStorage.setItem(MODE_KEY, "1");
  } catch {
    // Storage blocked; the widget stays off.
  }
}

export function widgetEnabled(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWidgetEnabled(on: boolean): void {
  const changed = widgetEnabled() !== on;
  localStorage.setItem(MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(MODE_EVENT));
  if (!changed) return;
  void (on ? shrinkWindow() : restoreWindow());
}

export function toggleWidget(): void {
  setWidgetEnabled(!widgetEnabled());
}
