export function usageTooltipPosition(
  anchor: { left: number; top: number; bottom: number },
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const margin = 8;
  const gap = 6;
  const desiredTop = anchor.bottom + gap + tooltip.height <= viewport.height - margin
    ? anchor.bottom + gap
    : anchor.top - gap - tooltip.height;
  return {
    left: Math.max(margin, Math.min(anchor.left, viewport.width - tooltip.width - margin)),
    top: Math.max(margin, Math.min(desiredTop, viewport.height - tooltip.height - margin)),
  };
}
