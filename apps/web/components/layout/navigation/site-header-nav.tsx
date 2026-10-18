'use client';

import { useEffect, useRef } from 'react';

import { useScroll } from '@/hooks/use-scroll';

export function SiteHeaderNav({ children }: { children?: React.ReactNode }) {
  const scrolled = useScroll(10);
  const frameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const header = frame?.parentElement;
    if (!frame || !header) return;

    const updateScale = () => {
      const width = frame.offsetWidth;
      if (width) {
        frame.style.setProperty(
          '--site-header-rest-scale',
          String(header.offsetWidth / width)
        );
      }
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    updateScale();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="not-found-hidden layout-wide:container before:bg-background sticky top-0 z-100 mx-auto w-full max-w-4xl shrink-0 transition-none before:absolute before:left-[-100vw] before:h-full before:w-[200vw] md:before:hidden [@media(max-width:896px)]:max-w-[calc(100%-1.5rem)]">
      <header
        className="site-header relative border border-transparent"
        data-scrolled={scrolled}
        aria-label="Site header"
      >
        <span className="site-header-flat" aria-hidden="true" />
        <span
          ref={frameRef}
          className="site-header-floating"
          aria-hidden="true"
        />
        <nav className="relative z-1 flex h-(--header-height) w-full items-center justify-between px-2.5">
          {children}
        </nav>
      </header>
    </div>
  );
}
