'use client';

import { useScroll } from '@/hooks/use-scroll';
import { cn } from '@/lib/utils';

export function SiteHeaderNav({ children }: { children?: React.ReactNode }) {
  const scrolled = useScroll(10);

  return (
    <div
      className={cn(
        'not-found-hidden layout-wide:container max-md:before:left sticky top-0 z-100 mx-auto w-full max-w-4xl shrink-0 transition-none [@media(max-width:896px)]:max-w-[calc(100%-1.5rem)]',
        'before:bg-background before:absolute before:left-[-100vw] before:h-full before:w-[200vw] md:before:hidden'
      )}
    >
      <header
        className={cn(
          'border-x-border screen-line-top screen-line-bottom md:bg-background ease-out-cubic rounded-none border border-y-transparent transition-[translate,margin,border-color,border-radius,background-color,box-shadow] duration-200 before:z-0 after:z-0 motion-reduce:duration-150',
          scrolled &&
            'md:border-border md:screen-line-top-none md:screen-line-bottom-none md:supports-backdrop-filter:bg-background/50 motion-reduce:translate-y-0 md:mx-2 md:translate-y-2 md:rounded-lg md:shadow-sm md:backdrop-blur-lg'
        )}
        aria-label="Site header"
      >
        <nav className="relative z-1 flex h-(--header-height) w-full items-center justify-between px-2.5">
          {children}
        </nav>
      </header>
    </div>
  );
}
