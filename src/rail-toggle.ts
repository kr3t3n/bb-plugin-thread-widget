import { mountLatest, watchRail } from "./rail-layout";
import { MODE_EVENT, toggleWidget, widgetEnabled } from "./mode";

const BUTTON_ATTR = "data-thread-widget-toggle";
const STYLE_ID = "thread-widget-toggle-style";

const CSS = `
[${BUTTON_ATTR}] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--bb-sidebar-control-size, 2rem);
  height: var(--bb-sidebar-control-size, 2rem);
  margin: 6px 0 4px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
}
[${BUTTON_ATTR}][aria-pressed="true"] {
  background: color-mix(in srgb, currentColor 14%, transparent);
}
[${BUTTON_ATTR}]:hover {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
[${BUTTON_ATTR}] svg {
  width: 16px;
  height: 16px;
  display: block;
}
`;

function paint(button: HTMLButtonElement): void {
  const value = widgetEnabled() ? "true" : "false";
  if (button.getAttribute("aria-pressed") !== value) button.setAttribute("aria-pressed", value);
}

export function mountRailToggle(signal: AbortSignal): void {
  mountLatest("thread-widget-rail", signal, mountToggle);
}

function mountToggle(signal: AbortSignal): void {
  const doc = document;
  if (doc.getElementById(STYLE_ID) === null) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  let button: HTMLButtonElement | null = null;
  const ensure = () => {
    if (signal.aborted) return;
    const nav = doc.querySelector<HTMLElement>('[data-testid="app-nav-rail"] nav');
    if (nav === null) return;

    if (button === null) {
      button = doc.createElement("button");
      button.type = "button";
      button.setAttribute(BUTTON_ATTR, "");
      button.setAttribute("aria-label", "Thread widget");
      button.title = "Thread widget";
      button.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2.5h10a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm1 2a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-15a1 1 0 0 0-1-1H8Z"/><path fill="currentColor" d="M8.2 7h7.6v1.5H8.2zm0 3.7h7.6v1.5H8.2zm0 3.7h5.1v1.5H8.2z"/></svg>';
      button.addEventListener("click", () => {
        toggleWidget();
        paint(button!);
      });
    }
    if (button.parentElement !== nav) nav.append(button);
    paint(button);
  };

  watchRail("thread-widget", signal, ensure);
  window.addEventListener(MODE_EVENT, ensure);
  signal.addEventListener(
    "abort",
    () => {
      window.removeEventListener(MODE_EVENT, ensure);
      button?.remove();
      doc.getElementById(STYLE_ID)?.remove();
    },
    { once: true },
  );
}
