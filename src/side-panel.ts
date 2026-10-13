/**
 * bb's right panel (info, diff, terminal, files) has no plugin API. The widget
 * opens the thread underneath, then presses bb's own panel buttons.
 */
const SHOW_PANEL = 'main button[aria-label^="Show right panel"]';
const HIDE_PANEL = 'button[aria-label^="Hide right panel"]';
const NEW_TAB = 'button[aria-label^="Open new tab"]';
const STEP_MS = 100;
const WAIT_MS = 4000;

function waitFor(
  selector: string,
  signal: AbortSignal,
  ready: () => boolean = () => true,
  timeoutMs = WAIT_MS,
  accept: (element: HTMLElement) => boolean = () => true,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (signal.aborted) return resolve(null);
      const element = ready()
        ? (Array.from(document.querySelectorAll<HTMLElement>(selector)).find(accept) ?? null)
        : null;
      if (element) return resolve(element);
      if (Date.now() - started > timeoutMs) return resolve(null);
      window.setTimeout(tick, STEP_MS);
    };
    tick();
  });
}

/** The widget's own buttons are hidden while it steps aside; skip them too. */
function onScreen(element: HTMLElement): boolean {
  if (element.closest(".thread-widget")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.left >= 0 && rect.right <= window.innerWidth;
}

export function panelOpen(): boolean {
  return document.querySelector(HIDE_PANEL) !== null;
}

/** Open the right panel; with `newTab`, also open bb's new-tab menu. */
export async function openSidePanel(
  threadId: string,
  newTab: boolean,
  signal: AbortSignal,
): Promise<boolean> {
  // The home screen has its own panel button. Wait for the thread's route.
  const onThread = () => window.location.pathname.includes(threadId);
  if ((await waitFor(SHOW_PANEL + ", " + HIDE_PANEL, signal, onThread)) === null) return false;
  // bb ignores the first click while the thread view is still loading, so
  // click again until the panel opens.
  for (let attempt = 0; attempt < 5 && !panelOpen(); attempt += 1) {
    const show = await waitFor(SHOW_PANEL, signal, onThread);
    if (show === null) return false;
    show.click();
    await waitFor(HIDE_PANEL, signal, () => true, 800);
  }
  if (!panelOpen()) return false;
  if (!newTab) return true;
  // bb's + opens a new-tab page in the panel: terminal, files, editor and more.
  const add = await waitFor(NEW_TAB, signal, () => true, WAIT_MS, onScreen);
  if (add === null) return true;
  add.click();
  return true;
}
