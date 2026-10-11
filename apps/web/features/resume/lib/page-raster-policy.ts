/**
 * Fallback page raster contract for the Resume viewer.
 *
 * Displayed geometry stays on fit-width, zoom, and a fixed A4 aspect. Canvas
 * backing follows that displayed width instead of a 900 CSS-pixel page. Mobile
 * viewports cap effective DPR at 2 so a 390 CSS-pixel phone at DPR 3 does not
 * allocate 2700x3818 canvases. Width buckets and a settle threshold keep CSS
 * zoom responsive. Visible-page scheduling can reuse these helpers to decide
 * when a mounted page should allocate a new canvas.
 */

export const RESUME_PAGE_WIDTH_OVER_HEIGHT = 210 / 297;
export const RESUME_PAGE_HEIGHT_OVER_WIDTH = 297 / 210;
export const RESUME_PAGE_ASPECT_RATIO = `${210} / ${297}`;

/** Matches native desktop selection at min-width 768px. */
export const RESUME_MOBILE_VIEWPORT_MAX_PX = 767;
export const RESUME_MOBILE_VIEWPORT_QUERY = `(max-width: ${RESUME_MOBILE_VIEWPORT_MAX_PX}px)`;

export const RESUME_PAGE_MAX_DISPLAY_WIDTH_PX = 900;
export const RESUME_MOBILE_MAX_EFFECTIVE_DPR = 2;
export const RESUME_DESKTOP_MAX_EFFECTIVE_DPR = 3;

/** Ceil-to-bucket overhead is at most this many CSS pixels minus 1. */
export const PAGE_RASTER_WIDTH_BUCKET_PX = 16;

/**
 * Per-page cap for the live react-pdf canvas.
 *
 * A stable page keeps only that canvas. A settled upgrade copies current
 * pixels into one overlay, then zeroes the overlay after the new raster
 * succeeds. Peak is 2 canvases per upgrading mounted page. Two pages
 * upgrading together can therefore reach 32MP, not 16MP.
 */
export const PAGE_RASTER_MAX_BACKING_PIXELS = 8_000_000;
export const PAGE_RASTER_STABLE_CANVASES_PER_PAGE = 1;
export const PAGE_RASTER_UPGRADE_CANVASES_PER_PAGE = 2;

/** Re-rasterize after settle only when backing width changes by at least 20%. */
export const PAGE_RASTER_COMMIT_RATIO = 1.2;

export const PAGE_RASTER_SETTLE_MS = 160;

export type PageRasterInput = {
  displayedWidthPx: number;
  devicePixelRatio: number;
  isMobileViewport: boolean;
};

export type PageRasterTarget = {
  rasterWidthPx: number;
  devicePixelRatio: number;
  backingWidthPx: number;
  backingHeightPx: number;
  backingPixelCount: number;
};

export function estimatePageRasterPeakBackingPixels(
  mountedPages: number,
  upgrading: boolean
): number {
  const pages = Math.max(0, mountedPages);
  const canvasesPerPage = upgrading
    ? PAGE_RASTER_UPGRADE_CANVASES_PER_PAGE
    : PAGE_RASTER_STABLE_CANVASES_PER_PAGE;
  return pages * canvasesPerPage * PAGE_RASTER_MAX_BACKING_PIXELS;
}

export function getPageDisplayHeightPx(displayedWidthPx: number): number {
  return Math.max(0, displayedWidthPx) * RESUME_PAGE_HEIGHT_OVER_WIDTH;
}

export function getPageRasterScale(
  displayedWidthPx: number,
  rasterWidthPx: number
): number {
  if (rasterWidthPx <= 0) return 1;
  return displayedWidthPx / rasterWidthPx;
}

export function pageRasterTargetKey(target: PageRasterTarget): string {
  return `${target.rasterWidthPx}:${target.backingWidthPx}:${target.backingHeightPx}`;
}

export function resolveEffectiveDevicePixelRatio(
  devicePixelRatio: number,
  isMobileViewport: boolean
): number {
  const raw =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const cap = isMobileViewport
    ? RESUME_MOBILE_MAX_EFFECTIVE_DPR
    : RESUME_DESKTOP_MAX_EFFECTIVE_DPR;
  return Math.min(Math.max(1, raw), cap);
}

export function bucketPageRasterWidth(displayedWidthPx: number): number {
  if (displayedWidthPx <= 0) return 0;
  return (
    Math.ceil(displayedWidthPx / PAGE_RASTER_WIDTH_BUCKET_PX) *
    PAGE_RASTER_WIDTH_BUCKET_PX
  );
}

export function resolvePageRasterTarget(
  input: PageRasterInput
): PageRasterTarget {
  const displayedWidthPx = Math.max(0, input.displayedWidthPx);
  if (displayedWidthPx === 0) {
    return {
      rasterWidthPx: 0,
      devicePixelRatio: 1,
      backingWidthPx: 0,
      backingHeightPx: 0,
      backingPixelCount: 0,
    };
  }

  const rasterWidthPx = bucketPageRasterWidth(displayedWidthPx);
  const uncappedDpr = resolveEffectiveDevicePixelRatio(
    input.devicePixelRatio,
    input.isMobileViewport
  );
  return capPageRasterTarget(rasterWidthPx, uncappedDpr);
}

export function shouldUpdatePageRaster(
  committed: PageRasterTarget,
  candidate: PageRasterTarget
): boolean {
  if (candidate.rasterWidthPx <= 0) return false;
  if (committed.rasterWidthPx <= 0) return true;
  if (pageRasterTargetKey(committed) === pageRasterTargetKey(candidate)) {
    return false;
  }

  const smaller = Math.min(committed.backingWidthPx, candidate.backingWidthPx);
  const larger = Math.max(committed.backingWidthPx, candidate.backingWidthPx);
  return larger / Math.max(1, smaller) >= PAGE_RASTER_COMMIT_RATIO;
}

function capPageRasterTarget(
  rasterWidthPx: number,
  devicePixelRatio: number
): PageRasterTarget {
  const uncapped = estimateBacking(rasterWidthPx, devicePixelRatio);
  if (uncapped.backingPixelCount <= PAGE_RASTER_MAX_BACKING_PIXELS) {
    return {
      rasterWidthPx,
      devicePixelRatio,
      ...uncapped,
    };
  }

  const factor = Math.sqrt(
    PAGE_RASTER_MAX_BACKING_PIXELS / uncapped.backingPixelCount
  );
  const backingWidthPx = Math.max(
    1,
    Math.floor(uncapped.backingWidthPx * factor)
  );
  const backingHeightPx = Math.max(
    1,
    Math.floor(uncapped.backingHeightPx * factor)
  );

  return {
    rasterWidthPx,
    devicePixelRatio: backingWidthPx / rasterWidthPx,
    backingWidthPx,
    backingHeightPx,
    backingPixelCount: backingWidthPx * backingHeightPx,
  };
}

function estimateBacking(
  rasterWidthPx: number,
  devicePixelRatio: number
): Pick<
  PageRasterTarget,
  'backingWidthPx' | 'backingHeightPx' | 'backingPixelCount'
> {
  const backingWidthPx = Math.max(
    1,
    Math.round(rasterWidthPx * devicePixelRatio)
  );
  const backingHeightPx = Math.max(
    1,
    Math.round(rasterWidthPx * RESUME_PAGE_HEIGHT_OVER_WIDTH * devicePixelRatio)
  );

  return {
    backingWidthPx,
    backingHeightPx,
    backingPixelCount: backingWidthPx * backingHeightPx,
  };
}
