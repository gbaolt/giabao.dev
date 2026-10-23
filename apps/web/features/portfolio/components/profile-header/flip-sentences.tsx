'use client';

import { useRef } from 'react';

import { TextFlip } from '@/components/ncdai/text-flip';
import { useView } from '@/hooks/use-view';

export function FlipSentences({
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children' | 'ref'> & {
  children: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { isPageInView, isInView } = useView(ref);

  return (
    <div ref={ref} aria-label="Flip sentences" {...props}>
      <TextFlip
        className="font-pixel-square shimmer shimmer-once shimmer-duration-2000 not-dark:shimmer-color-foreground text-muted-foreground text-sm text-balance"
        interval={3}
        play={isPageInView && isInView}
      >
        {children}
      </TextFlip>
    </div>
  );
}
