import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usageLimitLabel, type UsageLimit } from "./usage-limits";
import { usageTooltipPosition } from "./usage-tooltip";

export function UsageLimitBadge({ limit }: { limit: UsageLimit }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const detail = usageLimitLabel(limit);
  const clearClose = () => window.clearTimeout(closeTimer.current);
  const close = () => {
    clearClose();
    setOpen(false);
  };
  const show = () => {
    clearClose();
    setOpen(true);
  };
  const delayClose = () => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useLayoutEffect(() => {
    if (!open || button.current === null || tooltip.current === null) return;
    const position = usageTooltipPosition(
      button.current.getBoundingClientRect(),
      tooltip.current.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    );
    tooltip.current.style.left = `${position.left}px`;
    tooltip.current.style.top = `${position.top}px`;
  }, [open, detail]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismissPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !button.current?.contains(event.target) &&
        !tooltip.current?.contains(event.target)
      ) close();
    };
    const dismissKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", dismissPointer);
    document.addEventListener("keydown", dismissKey, true);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismissPointer);
      document.removeEventListener("keydown", dismissKey, true);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="thread-widget-usage-badge"
        aria-label={detail}
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={(event) => { if (event.pointerType !== "touch") delayClose(); }}
        onFocus={show}
        onBlur={close}
        onClick={(event) => { event.stopPropagation(); show(); }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 20" width="6" height="8" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 2h10M3 18h10M4 2v4c0 2 2 3 4 4-2 1-4 2-4 4v4M12 2v4c0 2-2 3-4 4 2 1 4 2 4 4v4" />
        </svg>
      </button>
      {open ? createPortal(
        <span
          ref={tooltip}
          id={id}
          role="tooltip"
          className="thread-widget-usage-tooltip"
          onPointerEnter={show}
          onPointerLeave={delayClose}
        >
          {detail}
        </span>,
        document.body,
      ) : null}
    </>
  );
}
