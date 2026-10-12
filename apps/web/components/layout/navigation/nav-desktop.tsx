'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/nav';

import { isNavItemActive } from './utils/nav-active';

export function NavDesktop({ items }: { items: NavItem<Route>[] }) {
  const pathname = usePathname();

  return <Nav className="max-md:hidden" items={items} activeId={pathname} />;
}

export function Nav({
  items,
  activeId,
  className,
  exactMatch = false,
}: {
  items: NavItem<Route>[];
  activeId?: string;
  className?: string;
  exactMatch?: boolean;
}) {
  return (
    <nav
      data-active-id={activeId}
      className={cn('flex items-center gap-4', className)}
    >
      {items.map(({ title, href }) => {
        const isActive = isNavItemActive(href, activeId, exactMatch);

        return (
          <NavItem
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
          >
            {title}
          </NavItem>
        );
      })}
    </nav>
  );
}

function NavItem({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground font-medium tracking-wide transition-[color]',
        className
      )}
      {...props}
    />
  );
}
