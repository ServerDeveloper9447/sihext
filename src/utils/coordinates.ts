import { AgentAction } from '../types';

/** Coordinates from the model are on a 0-1000 scale relative to the screenshot. */
const NORMALIZED_SCALE = 1000;

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/**
 * Converts the model's normalized x/y/targetX/targetY into real viewport
 * CSS pixels, which is what document.elementFromPoint() and dispatched
 * MouseEvent clientX/clientY expect.
 *
 * Because the coordinates are relative (0-1000), it doesn't matter whether
 * the screenshot was downscaled before sending, or captured at a different
 * devicePixelRatio -- the same fraction of the image maps to the same
 * fraction of the viewport. The only requirement is that the screenshot
 * shows the full viewport (not a cropped region).
 *
 * viewport comes from ExtractedDOMSummary.viewport (window.innerWidth/Height,
 * i.e. CSS pixels).
 */
export function denormalizeCoordinates(
  action: AgentAction,
  viewport: { width: number; height: number }
): AgentAction {
  const toX = (v: number) => clamp(Math.round((v / NORMALIZED_SCALE) * viewport.width), viewport.width - 1);
  const toY = (v: number) => clamp(Math.round((v / NORMALIZED_SCALE) * viewport.height), viewport.height - 1);

  return {
    ...action,
    x: action.x !== undefined ? toX(action.x) : undefined,
    y: action.y !== undefined ? toY(action.y) : undefined,
    targetX: action.targetX !== undefined ? toX(action.targetX) : undefined,
    targetY: action.targetY !== undefined ? toY(action.targetY) : undefined,
  };
}