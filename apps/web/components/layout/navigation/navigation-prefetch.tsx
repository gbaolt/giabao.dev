'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const DESKTOP_QUERY = '(min-width: 768px)';

const NavigationPrefetchContext = React.createContext<{
  isStartupSettled: boolean;
  setStartupSettled: (settled: boolean) => void;
} | null>(null);

export function NavigationPrefetchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isStartupSettled, setStartupSettled] = React.useState(false);
  const value = React.useMemo(
    () => ({ isStartupSettled, setStartupSettled }),
    [isStartupSettled]
  );

  return (
    <NavigationPrefetchContext value={value}>
      {children}
    </NavigationPrefetchContext>
  );
}

export function NavigationPrefetchBoundary({ ready }: { ready: boolean }) {
  const context = React.use(NavigationPrefetchContext);
  const setStartupSettled = context?.setStartupSettled;

  React.useLayoutEffect(() => {
    if (!setStartupSettled) return;
    setStartupSettled(false);
    if (!ready) return;

    const resume = () => setStartupSettled(true);
    const idle = 'requestIdleCallback' in window;
    const handle = idle
      ? window.requestIdleCallback(resume, { timeout: 1000 })
      : window.setTimeout(resume, 100);

    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      setStartupSettled(false);
    };
  }, [ready, setStartupSettled]);

  return null;
}

function subscribeToViewport(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function isDesktopViewport() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function NavigationLink({
  prefetch,
  onMouseEnter,
  onFocus,
  ...props
}: React.ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const context = React.use(NavigationPrefetchContext);
  const isDesktop = React.useSyncExternalStore(
    subscribeToViewport,
    isDesktopViewport,
    getServerSnapshot
  );
  const [intentState, setIntentState] = React.useState({
    pathname,
    active: false,
  });
  if (intentState.pathname !== pathname) {
    setIntentState({ pathname, active: false });
  }
  const intent = intentState.pathname === pathname && intentState.active;
  const defer =
    context &&
    pathname === '/resume' &&
    !isDesktop &&
    !context.isStartupSettled &&
    !intent;

  return (
    <Link
      {...props}
      prefetch={defer ? false : prefetch}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) setIntentState({ pathname, active: true });
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) setIntentState({ pathname, active: true });
      }}
    />
  );
}
