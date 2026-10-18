'use client';

import type { TOCItemType } from 'fumadocs-core/toc';
import dynamic from 'next/dynamic';

import { cn } from '@/lib/utils';

const ScrollProgress = dynamic(
  () =>
    import('@/components/ui/scroll-progress').then((mod) => mod.ScrollProgress),
  { ssr: false, loading: () => null }
);

export function TOCMinimap({
  items,
  className,
}: {
  items: TOCItemType[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <ScrollProgress
      className={cn('max-md:hidden', className)}
      sections={items.map((item) => ({
        id: decodeURIComponent(item.url.replace(/^#/, '')),
        label: item.title,
        depth: item.depth,
      }))}
    />
  );
}
