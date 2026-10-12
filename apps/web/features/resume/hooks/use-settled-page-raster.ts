import {
  startTransition,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  getRasterTarget,
  PAGE_RASTER_SETTLE_MS,
  type PageRasterInput,
  type PageRasterTarget,
  RESUME_MOBILE_VIEWPORT_QUERY,
  shouldUpdateRaster,
} from '../lib/page-raster-policy';
import { subscribeDevicePixelRatioChanges } from '../lib/subscribe-device-pixel-ratio';

function getDevicePixelRatioSnapshot() {
  return window.devicePixelRatio;
}

function getDevicePixelRatioServerSnapshot() {
  return 1;
}

function subscribeMobileViewport(onStoreChange: () => void) {
  const media = window.matchMedia(RESUME_MOBILE_VIEWPORT_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(RESUME_MOBILE_VIEWPORT_QUERY).matches;
}

function getMobileViewportServerSnapshot() {
  return false;
}

export function useDevicePixelRatio() {
  return useSyncExternalStore(
    subscribeDevicePixelRatioChanges,
    getDevicePixelRatioSnapshot,
    getDevicePixelRatioServerSnapshot
  );
}

export function useIsMobileViewport() {
  return useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot
  );
}

export function useSettledPageRaster(input: PageRasterInput): PageRasterTarget {
  const candidate = getRasterTarget(input);
  const [committed, setCommitted] = useState(candidate);
  const needsSettle = shouldUpdateRaster(committed, candidate);

  useEffect(() => {
    if (!needsSettle) return;

    const nextTarget: PageRasterTarget = {
      rasterWidthPx: candidate.rasterWidthPx,
      devicePixelRatio: candidate.devicePixelRatio,
      backingWidthPx: candidate.backingWidthPx,
      backingHeightPx: candidate.backingHeightPx,
      backingPixelCount: candidate.backingPixelCount,
    };
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setCommitted(nextTarget);
      });
    }, PAGE_RASTER_SETTLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    candidate.backingHeightPx,
    candidate.backingPixelCount,
    candidate.backingWidthPx,
    candidate.devicePixelRatio,
    candidate.rasterWidthPx,
    needsSettle,
  ]);

  return committed;
}
