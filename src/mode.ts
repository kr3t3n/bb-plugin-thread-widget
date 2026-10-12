export const MODE_KEY = "bb-plugin-thread-widget:enabled";
export const MODE_EVENT = "thread-widget-mode";

export function widgetEnabled(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWidgetEnabled(on: boolean): void {
  localStorage.setItem(MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(MODE_EVENT));
}

export function toggleWidget(): void {
  setWidgetEnabled(!widgetEnabled());
}
