const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

// Layout is a data-only snapshot. Ignore accessors and unrelated project fields.
function ownValue(record, key) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function finiteDIP(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

function rectangle(record, inward = false) {
  const x = ownValue(record, 'x');
  const y = ownValue(record, 'y');
  const width = ownValue(record, 'width');
  const height = ownValue(record, 'height');
  if (![x, y, width, height].every(finiteDIP) || width <= 0 || height <= 0) return null;
  if (![x + width, y + height].every(finiteDIP)) return null;
  const left = inward ? Math.ceil(x) : Math.round(x);
  const top = inward ? Math.ceil(y) : Math.round(y);
  const normalizedWidth = inward ? Math.floor(x + width) - left : Math.max(1, Math.round(width));
  const normalizedHeight = inward ? Math.floor(y + height) - top : Math.max(1, Math.round(height));
  if (normalizedWidth <= 0 || normalizedHeight <= 0 ||
      ![left + normalizedWidth, top + normalizedHeight].every(finiteDIP)) return null;
  return { x: left, y: top, width: normalizedWidth, height: normalizedHeight };
}

function validDisplayId(id) {
  return Number.isSafeInteger(id) || (typeof id === 'string' && id.length > 0 && id.length <= 128);
}

function overlapArea(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

function preferredDisplay(candidates, displayId) {
  return candidates.find(display => display.id === displayId) ??
    candidates.find(display => display.primary) ?? candidates[0];
}

/**
 * Restore a data-only layout against current display workAreas, already in DIP.
 * Displays: [{id: number|string, workArea: {x,y,width,height}, primary?: boolean}].
 * Return: {normalBounds: {x,y,width,height}, displayId, maximized, fullscreen}.
 * The display hint breaks overlap ties or rehomes a wholly offscreen rectangle;
 * a current overlapping display otherwise wins. Normal bounds fit wholly inside
 * its workArea, including when the area is smaller than the default window.
 * No current usable display throws RangeError with code NO_USABLE_DISPLAY.
 */
export function restoreBounds(snapshot, displays) {
  const usable = [];
  if (Array.isArray(displays)) {
    for (const display of displays) {
      const id = ownValue(display, 'id');
      const workArea = rectangle(ownValue(display, 'workArea'), true);
      if (validDisplayId(id) && workArea) usable.push({ id, workArea, primary: ownValue(display, 'primary') === true });
    }
  }
  if (!usable.length) {
    const error = new RangeError('No usable current display workArea');
    error.code = 'NO_USABLE_DISPLAY';
    throw error;
  }

  const saved = rectangle(ownValue(snapshot, 'normalBounds'));
  const displayId = ownValue(snapshot, 'displayId');
  let candidates = usable;
  if (saved) {
    const overlaps = usable.map(display => overlapArea(saved, display.workArea));
    const largest = Math.max(...overlaps);
    if (largest > 0) candidates = usable.filter((display, index) => overlaps[index] === largest);
  }
  const selected = preferredDisplay(candidates, displayId);
  const area = selected.workArea;
  const width = Math.min(saved?.width ?? DEFAULT_WIDTH, area.width);
  const height = Math.min(saved?.height ?? DEFAULT_HEIGHT, area.height);
  const x = saved?.x ?? area.x + Math.floor((area.width - width) / 2);
  const y = saved?.y ?? area.y + Math.floor((area.height - height) / 2);
  return {
    normalBounds: {
      x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
      width,
      height,
    },
    displayId: selected.id,
    maximized: ownValue(snapshot, 'maximized') === true,
    fullscreen: ownValue(snapshot, 'fullscreen') === true,
  };
}
