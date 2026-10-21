import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleChevronDownIcon,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function CollapsibleList<T>({
  items,
  max = 3,
  className,
  triggerClassName,
  keyExtractor,
  renderItem,
}: {
  items: T[];
  max?: number;
  className?: string;
  triggerClassName?: string;
  keyExtractor?: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <Collapsible
      className={cn(
        'group/collapsible [&>ul:first-child>li:first-child>*]:border-t-0',
        className
      )}
    >
      <ul>
        {items.slice(0, max).map((item, index) => (
          <li
            key={
              typeof keyExtractor === 'function' ? keyExtractor(item) : index
            }
          >
            {renderItem(item)}
          </li>
        ))}
      </ul>

      <CollapsibleContent render={<ul />}>
        {items.slice(max).map((item, index) => (
          <li
            key={
              typeof keyExtractor === 'function'
                ? keyExtractor(item)
                : max + index
            }
          >
            {renderItem(item)}
          </li>
        ))}
      </CollapsibleContent>

      {items.length > max && (
        <div
          className={cn(
            'border-border flex h-12 items-center justify-center border-t pb-px',
            triggerClassName
          )}
        >
          <CollapsibleTrigger
            render={
              <Button
                size="sm"
                variant="secondary"
                className="shadow-foreground/20 gap-2 pr-2.5 pl-3 shadow-[inset_0_0_1px]"
              />
            }
          >
            <span className="hidden group-data-closed/collapsible:block">
              Show More
            </span>
            <span className="hidden group-data-open/collapsible:block">
              Show Less
            </span>
            <CollapsibleChevronDownIcon />
          </CollapsibleTrigger>
        </div>
      )}
    </Collapsible>
  );
}
