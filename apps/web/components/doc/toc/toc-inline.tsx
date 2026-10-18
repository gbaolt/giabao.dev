'use client';

import type { TOCItemType } from 'fumadocs-core/toc';
import { TextIcon } from 'lucide-react';
import Link from 'next/link';

import {
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Collapsible,
  CollapsibleChevronDownIcon,
} from '@/components/ui/collapsible-animated';
import { cn } from '@/lib/utils';

export function TOCInline({
  items,
  className,
  children,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof Collapsible> & {
  items: TOCItemType[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <Collapsible
      data-slot="toc-inline"
      className={cn(
        'not-typeset group/inline-toc bg-surface inset-ring-border/64 rounded-lg font-sans inset-ring-1',
        className
      )}
      onOpenChange={(open, eventDetails) => {
        onOpenChange?.(open, eventDetails);
      }}
      {...props}
    >
      <CollapsibleTrigger className="focus-visible:inset-ring-ring/50 inline-flex w-full items-center gap-2 rounded-xl py-2.5 pr-2 pl-4 text-sm font-medium outline-none group-data-open/inline-toc:rounded-b-none focus-visible:inset-ring-2 [&_svg]:size-4">
        <TextIcon className="-translate-x-0.5" />
        {children ?? 'On this page'}
        <div className="text-muted-foreground ml-auto shrink-0">
          <CollapsibleChevronDownIcon duration={0.15} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="flex flex-col px-2 pb-2">
          {items.map((item) => (
            <li
              key={item.url}
              className="hover:bg-muted group/toc-item flex rounded-md px-2 py-1 transition-colors"
            >
              <Link
                href={item.url}
                data-depth={item.depth}
                className="text-muted-foreground group-hover/toc-item:text-accent-foreground w-full text-sm data-[depth=3]:pl-4 data-[depth=4]:pl-8"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
