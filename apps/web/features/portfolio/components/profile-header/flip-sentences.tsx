'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    function startRotation() {
      setHasInteracted(true);
      window.removeEventListener('pointerdown', startRotation);
      window.removeEventListener('keydown', startRotation);
    }

    window.addEventListener('pointerdown', startRotation, { passive: true });
    window.addEventListener('keydown', startRotation);
    return () => {
      window.removeEventListener('pointerdown', startRotation);
      window.removeEventListener('keydown', startRotation);
    };
  }, []);

  return (
    <div ref={ref} aria-label="Flip sentences" {...props}>
      <TextFlip
        className="font-pixel-square text-muted-foreground text-sm text-balance"
        interval={3}
        play={hasInteracted && isPageInView && isInView}
      >
        {children}
      </TextFlip>
    </div>
  );
}
