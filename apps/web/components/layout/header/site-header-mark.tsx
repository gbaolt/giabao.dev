'use client';

import { useMotionValueEvent, useScroll } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { BrandMark } from '@/components/app/brand';
import { useMediaQuery } from '@/hooks/use-media-query';

const calcDistance = (el: HTMLElement, mobile: boolean) => {
  const rect = el.getBoundingClientRect();
  const scrollTop = document.documentElement.scrollTop;
  const headerHeight = mobile ? 58 : 65;
  return scrollTop + rect.top + rect.height - headerHeight;
};

function BrandMotion() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const mobile = useMediaQuery('(max-width: 640px)');
  const distanceRef = useRef(160);

  useMotionValueEvent(scrollY, 'change', (latestValue) => {
    setVisible(latestValue >= distanceRef.current);
  });

  useEffect(() => {
    const coverMark = document.getElementById('js-cover-mark');
    if (!coverMark) return;

    distanceRef.current = calcDistance(coverMark, mobile);

    const resizeObserver = new ResizeObserver(() => {
      distanceRef.current = calcDistance(coverMark, mobile);
    });
    resizeObserver.observe(coverMark);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mobile]);

  return (
    <div data-visible={visible} className="group/motion relative">
      <BrandMark
        fillOpacity={0}
        aria-hidden="true"
        className="ease-out-cubic stroke-foreground no-focus absolute top-0 left-0 opacity-100 transition-opacity duration-300 select-none group-data-[visible=true]/motion:opacity-0"
        tabIndex={-1}
      />
      <BrandMark className="ease-out-cubic no-focus translate-y-2 opacity-0 transition-[opacity,translate] duration-300 group-data-[visible=true]/motion:translate-y-0 group-data-[visible=true]/motion:opacity-100" />
    </div>
  );
}

export function SiteHeaderMark() {
  const pathname = usePathname();
  const isHome = ['/', '/index'].includes(pathname);
  return isHome ? <BrandMotion /> : <BrandMark />;
}
