export type ResolutionMediaQueryList = {
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

export type SubscribeDevicePixelRatioOptions = {
  matchMedia?: (query: string) => ResolutionMediaQueryList;
  getDevicePixelRatio?: () => number;
};

export function resolutionMediaQuery(devicePixelRatio: number): string {
  return `(resolution: ${devicePixelRatio}dppx)`;
}

export function subscribeDevicePixelRatioChanges(
  onStoreChange: () => void,
  options: SubscribeDevicePixelRatioOptions = {}
): () => void {
  const matchMedia =
    options.matchMedia ?? ((query: string) => window.matchMedia(query));
  const getDevicePixelRatio =
    options.getDevicePixelRatio ?? (() => window.devicePixelRatio);

  let media = matchMedia(resolutionMediaQuery(getDevicePixelRatio()));

  const handleChange = () => {
    media.removeEventListener('change', handleChange);
    media = matchMedia(resolutionMediaQuery(getDevicePixelRatio()));
    media.addEventListener('change', handleChange);
    onStoreChange();
  };

  media.addEventListener('change', handleChange);
  return () => media.removeEventListener('change', handleChange);
}
