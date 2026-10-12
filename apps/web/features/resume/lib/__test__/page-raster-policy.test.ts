import { expect, test } from 'bun:test';

import {
  bucketRasterWidth,
  clampDpr,
  estimatePeakPixels,
  getPageHeight,
  getRasterScale,
  getRasterTarget,
  PAGE_RASTER_COMMIT_RATIO,
  PAGE_RASTER_MAX_BACKING_PIXELS,
  PAGE_RASTER_UPGRADE_CANVASES_PER_PAGE,
  PAGE_RASTER_WIDTH_BUCKET_PX,
  type PageRasterTarget,
  RESUME_MOBILE_MAX_EFFECTIVE_DPR,
  RESUME_PAGE_HEIGHT_OVER_WIDTH,
  RESUME_PAGE_MAX_DISPLAY_WIDTH_PX,
  shouldUpdateRaster,
} from '../page-raster-policy';

const MOBILE_VIEWPORTS = [320, 390, 440] as const;
const DEVICE_PIXEL_RATIOS = [1, 2, 3] as const;
const OBSERVED_390_DISPLAY_WIDTH_PX = 332;
const BYTES_PER_PIXEL = 4;
const PAGE_COUNT = 2;

function legacyFixedWidthTarget(devicePixelRatio: number): PageRasterTarget {
  const usedDpr = Math.max(2, devicePixelRatio);
  const backingWidthPx = RESUME_PAGE_MAX_DISPLAY_WIDTH_PX * usedDpr;
  const backingHeightPx = Math.round(
    RESUME_PAGE_MAX_DISPLAY_WIDTH_PX * RESUME_PAGE_HEIGHT_OVER_WIDTH * usedDpr
  );

  return {
    rasterWidthPx: RESUME_PAGE_MAX_DISPLAY_WIDTH_PX,
    devicePixelRatio: usedDpr,
    backingWidthPx,
    backingHeightPx,
    backingPixelCount: backingWidthPx * backingHeightPx,
  };
}

test('mobile fit-width follows displayed width and caps effective DPR at 2', () => {
  const target = getRasterTarget({
    displayedWidthPx: OBSERVED_390_DISPLAY_WIDTH_PX,
    devicePixelRatio: 3,
    isMobileViewport: true,
  });

  expect(target.rasterWidthPx).toBe(
    bucketRasterWidth(OBSERVED_390_DISPLAY_WIDTH_PX)
  );
  expect(target.rasterWidthPx).toBeLessThan(RESUME_PAGE_MAX_DISPLAY_WIDTH_PX);
  expect(target.devicePixelRatio).toBe(RESUME_MOBILE_MAX_EFFECTIVE_DPR);
  expect(target.backingWidthPx).toBe(
    target.rasterWidthPx * RESUME_MOBILE_MAX_EFFECTIVE_DPR
  );
  expect(target.backingWidthPx).toBeLessThan(2700);
  expect(target.backingHeightPx).toBeLessThan(3818);
});

test('mobile fit-width budgets stay far below the fixed 900 CSS-pixel baseline', () => {
  for (const viewportWidth of MOBILE_VIEWPORTS) {
    for (const devicePixelRatio of DEVICE_PIXEL_RATIOS) {
      const target = getRasterTarget({
        displayedWidthPx: viewportWidth,
        devicePixelRatio,
        isMobileViewport: true,
      });
      const legacy = legacyFixedWidthTarget(devicePixelRatio);

      expect(target.devicePixelRatio).toBeLessThanOrEqual(
        RESUME_MOBILE_MAX_EFFECTIVE_DPR
      );
      expect(target.rasterWidthPx).toBe(bucketRasterWidth(viewportWidth));
      expect(target.backingPixelCount).toBeLessThan(legacy.backingPixelCount);
      expect(target.backingPixelCount / legacy.backingPixelCount).toBeLessThan(
        0.25
      );
    }
  }

  const observed = getRasterTarget({
    displayedWidthPx: OBSERVED_390_DISPLAY_WIDTH_PX,
    devicePixelRatio: 3,
    isMobileViewport: true,
  });
  const observedBytes =
    observed.backingPixelCount * PAGE_COUNT * BYTES_PER_PIXEL;
  const legacyBytes =
    legacyFixedWidthTarget(3).backingPixelCount * PAGE_COUNT * BYTES_PER_PIXEL;

  expect(observedBytes).toBeLessThan(6 * 1024 * 1024);
  expect(legacyBytes).toBeGreaterThan(78 * 1024 * 1024);
});

test('desktop fallback may use device DPR 3 until the pixel cap applies', () => {
  const target = getRasterTarget({
    displayedWidthPx: 720,
    devicePixelRatio: 3,
    isMobileViewport: false,
  });

  expect(target.devicePixelRatio).toBe(3);
  expect(target.rasterWidthPx).toBe(720);
  expect(target.backingWidthPx).toBe(2160);
});

test('DPR 1 does not force a minimum backing density of 2', () => {
  const mobile = getRasterTarget({
    displayedWidthPx: 320,
    devicePixelRatio: 1,
    isMobileViewport: true,
  });
  const desktop = getRasterTarget({
    displayedWidthPx: 720,
    devicePixelRatio: 1,
    isMobileViewport: false,
  });

  expect(mobile.devicePixelRatio).toBe(1);
  expect(mobile.backingWidthPx).toBe(320);
  expect(desktop.devicePixelRatio).toBe(1);
  expect(desktop.backingWidthPx).toBe(720);
});

test('width buckets round up and document at most 15 CSS pixels of overhead', () => {
  expect(bucketRasterWidth(332)).toBe(336);
  expect(bucketRasterWidth(320)).toBe(320);
  expect(bucketRasterWidth(440)).toBe(448);

  const target = getRasterTarget({
    displayedWidthPx: 332,
    devicePixelRatio: 2,
    isMobileViewport: true,
  });

  expect(target.rasterWidthPx - 332).toBeLessThan(PAGE_RASTER_WIDTH_BUCKET_PX);
  expect(getRasterScale(332, target.rasterWidthPx)).toBeCloseTo(332 / 336);
});

test('pixel cap reduces 300 percent zoom on a 440 CSS-pixel mobile page', () => {
  const target = getRasterTarget({
    displayedWidthPx: 440 * 3,
    devicePixelRatio: 3,
    isMobileViewport: true,
  });

  expect(target.rasterWidthPx).toBe(bucketRasterWidth(1320));
  expect(target.backingPixelCount).toBeLessThanOrEqual(
    PAGE_RASTER_MAX_BACKING_PIXELS
  );
  expect(target.devicePixelRatio).toBeLessThan(RESUME_MOBILE_MAX_EFFECTIVE_DPR);
  expect(target.backingWidthPx / target.rasterWidthPx).toBeCloseTo(
    target.devicePixelRatio
  );
});

test('page geometry is independent of raster backing', () => {
  const displayedWidthPx = 332;
  const mobile = getRasterTarget({
    displayedWidthPx,
    devicePixelRatio: 3,
    isMobileViewport: true,
  });
  const desktop = getRasterTarget({
    displayedWidthPx: 900,
    devicePixelRatio: 3,
    isMobileViewport: false,
  });

  expect(getPageHeight(displayedWidthPx)).toBe(
    displayedWidthPx * RESUME_PAGE_HEIGHT_OVER_WIDTH
  );
  expect(getPageHeight(displayedWidthPx)).not.toBe(mobile.backingHeightPx);
  expect(getPageHeight(900)).not.toBe(desktop.backingHeightPx);
  expect(getRasterScale(displayedWidthPx, mobile.rasterWidthPx)).not.toBe(
    mobile.devicePixelRatio
  );
});

test('small width snaps stay on the committed raster', () => {
  const committed = getRasterTarget({
    displayedWidthPx: 332,
    devicePixelRatio: 2,
    isMobileViewport: true,
  });
  const snapped = getRasterTarget({
    displayedWidthPx: 336,
    devicePixelRatio: 2,
    isMobileViewport: true,
  });

  expect(committed.rasterWidthPx).toBe(snapped.rasterWidthPx);
  expect(shouldUpdateRaster(committed, snapped)).toBe(false);
});

test('a 25 percent zoom step crosses the settled upgrade threshold', () => {
  const fit = getRasterTarget({
    displayedWidthPx: 332,
    devicePixelRatio: 2,
    isMobileViewport: true,
  });
  const zoomed = getRasterTarget({
    displayedWidthPx: Math.floor(332 * 1.25),
    devicePixelRatio: 2,
    isMobileViewport: true,
  });

  expect(zoomed.backingWidthPx / fit.backingWidthPx).toBeGreaterThanOrEqual(
    PAGE_RASTER_COMMIT_RATIO
  );
  expect(shouldUpdateRaster(fit, zoomed)).toBe(true);
  expect(shouldUpdateRaster(zoomed, fit)).toBe(true);
});

test('peak backing is one canvas at rest and two per page during an upgrade', () => {
  expect(estimatePeakPixels(2, false)).toBe(2 * PAGE_RASTER_MAX_BACKING_PIXELS);
  expect(estimatePeakPixels(2, true)).toBe(
    2 * PAGE_RASTER_UPGRADE_CANVASES_PER_PAGE * PAGE_RASTER_MAX_BACKING_PIXELS
  );
  expect(estimatePeakPixels(2, true)).toBe(32_000_000);
});

test('invalid or empty inputs do not allocate a canvas', () => {
  expect(
    getRasterTarget({
      displayedWidthPx: 0,
      devicePixelRatio: 3,
      isMobileViewport: true,
    }).backingPixelCount
  ).toBe(0);
  expect(clampDpr(Number.NaN, true)).toBe(1);
  expect(
    shouldUpdateRaster(legacyFixedWidthTarget(2), {
      rasterWidthPx: 0,
      devicePixelRatio: 1,
      backingWidthPx: 0,
      backingHeightPx: 0,
      backingPixelCount: 0,
    })
  ).toBe(false);
  expect(
    shouldUpdateRaster(
      {
        rasterWidthPx: 0,
        devicePixelRatio: 1,
        backingWidthPx: 0,
        backingHeightPx: 0,
        backingPixelCount: 0,
      },
      getRasterTarget({
        displayedWidthPx: 332,
        devicePixelRatio: 2,
        isMobileViewport: true,
      })
    )
  ).toBe(true);
});
