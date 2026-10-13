import { useEffect, useState, type RefObject } from "react";

/** bb's sidebar toggle. The macOS app draws it next to the traffic lights. */
const TOGGLE_SELECTOR = '[aria-label^="Toggle sidebar"]';
const GAP_PX = 8;

/**
 * How far the header must start so bb's own window controls do not cover
 * it. The toggle sits right of the traffic lights, so clearing it clears both.
 */
export function chromeInsetPx(header: HTMLElement, root: ParentNode = document): number {
  const box = header.getBoundingClientRect();
  let inset = 0;
  for (const button of Array.from(root.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR))) {
    if (header.contains(button)) continue;
    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom <= box.top || rect.top >= box.bottom) continue;
    // Only controls on the left half belong to the window chrome.
    if (rect.left > box.left + box.width / 2) continue;
    inset = Math.max(inset, rect.right - box.left + GAP_PX);
  }
  return Math.ceil(inset);
}

/** Track the inset while the header is on screen. */
export function useChromeInset(header: RefObject<HTMLElement | null>, active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const element = header.current;
      if (element) setInset(chromeInsetPx(element));
    };
    measure();
    // bb moves the toggle on resize, fullscreen and sidebar changes.
    const timer = window.setInterval(measure, 1000);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [header, active]);
  return inset;
}
