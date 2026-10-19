'use client';

import { useInView, usePageInView } from 'motion/react';
import { useRef } from 'react';

import { Mascot } from '@/components/app/mascot';

const directions =
  'https://assets.giabao.dev/mascots/gbaolt-directions.webp?t=1792400940';
const className =
  'ring-border ring-offset-background focus-visible:outline-ring/50 size-full! overflow-hidden rounded-full ring-1 ring-offset-2 [image-rendering:pixelated] focus-visible:outline-offset-2 [&>span]:origin-center! [&>span]:translate-y-[6%] [&>span]:scale-[1.12]';

export function ProfileMascot() {
  const ref = useRef<HTMLDivElement>(null);
  const isPageInView = usePageInView();
  const isInView = useInView(ref);

  return (
    <div ref={ref} className="size-full">
      {isPageInView && isInView ? (
        <Mascot
          directions={directions}
          reactions="https://assets.giabao.dev/mascots/gbaolt-reactions.webp?t=1792400940"
          label="Gia Bảo pixel avatar"
          size={160}
          className={className}
        />
      ) : (
        <div role="img" aria-label="Gia Bảo pixel avatar" className={className}>
          <span className="relative block size-full">
            <span
              className="absolute inset-0 bg-size-[300%_300%] bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${directions})` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
