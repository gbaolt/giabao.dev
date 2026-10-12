'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/nav';

import { buildNavPath, splitItems } from './utils/mobile-nav-notch';
import { isNavItemActive } from './utils/nav-active';

const DOCK_NAV_CLASS =
  'bg-popover relative flex grid-cols-4 items-center rounded-2xl p-1.5 shadow-md';

const CENTER_TRIGGER_CLASS = cn(
  '**:data-[slot=command-menu-trigger]:border-border **:data-[slot=command-menu-trigger]:hover:bg-foreground **:data-[slot=command-menu-trigger]:active:bg-foreground **:data-[slot=command-menu-trigger]:text-primary-foreground **:data-[slot=command-menu-trigger]:ring-ring/50 **:data-[slot=command-menu-trigger]:bg-zinc-800 **:data-[slot=command-menu-trigger]:ring-2 **:dark:data-[slot=command-menu-trigger]:bg-zinc-200',
  '**:data-[slot=command-menu-trigger]:extend-touch-target pointer-events-auto **:data-[slot=command-menu-trigger]:size-10 **:data-[slot=command-menu-trigger]:min-w-10 **:data-[slot=command-menu-trigger]:shrink-0 **:data-[slot=command-menu-trigger]:rounded-full **:data-[slot=command-menu-trigger]:p-0',
  '[&_[data-slot=command-menu-trigger]_[data-slot=kbd-group]]:hidden [&_[data-slot=command-menu-trigger]>span]:hidden'
);

type NavMobileProps = {
  items: NavItem[];
  children?: ReactNode;
  className?: string;
};

export function NavMobile({ items, children, className }: NavMobileProps) {
  return (
    <div className={cn('relative', className)} data-slot="mobile-nav-root">
      {children ? (
        <NavMobileNotched items={items}>{children}</NavMobileNotched>
      ) : (
        <NavMobileDock items={items} />
      )}
    </div>
  );
}

function NavMobileDock({ items }: { items: NavItem[] }) {
  return (
    <nav
      data-slot="mobile-nav-dock"
      className={DOCK_NAV_CLASS}
      aria-label="Mobile section dock"
    >
      {items.length > 0 && <NavMobileGroup items={items} />}
    </nav>
  );
}

function NavMobileNotched({
  items,
  children,
}: {
  items: NavItem[];
  children: ReactNode;
}) {
  const [navNode, setNavNode] = useState<HTMLElement | null>(null);
  const size = useElementSize(navNode);
  const clipId = useId().replace(/:/g, '');
  const pathD = size ? buildNavPath(size.w, size.h) : null;
  const { leading, trailing } = splitItems(items, true);

  return (
    <div className="relative" data-slot="mobile-nav-content">
      {pathD && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute size-0 overflow-hidden"
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={pathD} />
            </clipPath>
          </defs>
        </svg>
      )}

      <nav
        ref={setNavNode}
        data-slot="mobile-nav-dock"
        className={DOCK_NAV_CLASS}
        style={pathD ? { clipPath: `url(#${clipId})` } : undefined}
        aria-label="Mobile section dock"
      >
        {leading.length > 0 && (
          <NavMobileGroup items={leading} className="flex-1 justify-end" />
        )}
        <div className="w-16 shrink-0" aria-hidden />
        {trailing.length > 0 && (
          <NavMobileGroup items={trailing} className="flex-1 justify-start" />
        )}
      </nav>

      {pathD && size && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-foreground/10 dark:text-foreground/20"
          />
        </svg>
      )}

      <div className="pointer-events-none absolute inset-x-0 -top-4 flex justify-center">
        <div className={CENTER_TRIGGER_CLASS}>{children}</div>
      </div>
    </div>
  );
}

function NavMobileGroup({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      data-slot="mobile-nav-group"
    >
      {items.map((item) => (
        <NavMobileItem key={item.href} item={item} />
      ))}
    </div>
  );
}

function NavMobileItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isNavItemActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="extend-touch-target rounded-lg active:scale-100"
      render={
        <Link
          href={item.href}
          aria-label={item.title}
          aria-current={active ? 'page' : undefined}
          title={item.title}
          data-slot="mobile-nav-link"
        />
      }
      nativeButton={false}
    >
      {Icon && <Icon className="size-5" />}
    </Button>
  );
}

function useElementSize(node: HTMLElement | null) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!node) return;

    const updateSize = () => {
      const { width, height } = node.getBoundingClientRect();
      const w = Math.round(width);
      const h = Math.round(height);
      setSize((prev) => (prev?.w === w && prev?.h === h ? prev : { w, h }));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return size;
}
