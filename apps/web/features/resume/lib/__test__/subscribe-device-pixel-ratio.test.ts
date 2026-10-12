import { expect, test } from 'bun:test';

import {
  resolutionMediaQuery,
  type ResolutionMediaQueryList,
  subscribeDevicePixelRatioChanges,
} from '../subscribe-device-pixel-ratio';

function createResolutionMedia() {
  const listeners = new Map<string, Set<() => void>>();
  let devicePixelRatio = 2;

  const matchMedia = (query: string): ResolutionMediaQueryList => ({
    addEventListener(_type, listener) {
      const bucket = listeners.get(query) ?? new Set();
      bucket.add(listener);
      listeners.set(query, bucket);
    },
    removeEventListener(_type, listener) {
      listeners.get(query)?.delete(listener);
    },
  });

  return {
    matchMedia,
    getDevicePixelRatio: () => devicePixelRatio,
    setDevicePixelRatio(next: number) {
      devicePixelRatio = next;
    },
    listenerCount(query: string) {
      return listeners.get(query)?.size ?? 0;
    },
    fire(query: string) {
      for (const listener of [...(listeners.get(query) ?? [])]) {
        listener();
      }
    },
  };
}

test('DPR subscription rebinds so later ratio changes are still observed', () => {
  const media = createResolutionMedia();
  const seen: number[] = [];

  const unsubscribe = subscribeDevicePixelRatioChanges(() => {
    seen.push(media.getDevicePixelRatio());
  }, media);

  expect(media.listenerCount(resolutionMediaQuery(2))).toBe(1);

  media.setDevicePixelRatio(3);
  media.fire(resolutionMediaQuery(2));
  expect(seen).toEqual([3]);
  expect(media.listenerCount(resolutionMediaQuery(2))).toBe(0);
  expect(media.listenerCount(resolutionMediaQuery(3))).toBe(1);

  media.setDevicePixelRatio(1.5);
  media.fire(resolutionMediaQuery(2));
  expect(seen).toEqual([3]);

  media.fire(resolutionMediaQuery(3));
  expect(seen).toEqual([3, 1.5]);
  expect(media.listenerCount(resolutionMediaQuery(3))).toBe(0);
  expect(media.listenerCount(resolutionMediaQuery(1.5))).toBe(1);

  unsubscribe();
  media.fire(resolutionMediaQuery(1.5));
  expect(seen).toEqual([3, 1.5]);
});
