'use client';

import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { BrandMark } from '@/components/app/brand';
import { PanelContent } from '@/components/app/panel';
import { Label } from '@/components/ui/label';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const CanvasReveal = dynamic(
  () =>
    import('@/components/aceternity/canvas-reveal').then(
      (mod) => mod.CanvasReveal
    ),
  { ssr: false }
);

export function ProfileCover() {
  return (
    <CanvasHover className="-mt-8">
      <div className="z-20">
        <div className="-mt-8 flex flex-col items-center gap-4">
          <BrandMark
            id="js-cover-mark"
            className="ease-out-cubic h-auto w-28 translate-y-6 transition duration-500 group-hover/canvas:translate-y-0 group-data-[expanded=true]/canvas:translate-y-0 sm:w-32"
          />
          <Label className="ease-out-cubic font-pixel text-lg opacity-0 transition duration-500 group-hover/canvas:opacity-100 group-data-[expanded=true]/canvas:opacity-100 sm:text-xl">
            giabao.dev
          </Label>
        </div>
      </div>
    </CanvasHover>
  );
}

function CanvasHover({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [isActive, setIsActive] = useState(false);
  const isTouchDevice = useMediaQuery('(pointer: coarse)');
  const isExpanded = isTouchDevice && isActive;

  return (
    <PanelContent
      onMouseEnter={() => {
        setIsActive(true);
      }}
      onMouseLeave={() => {
        setIsActive(false);
      }}
      data-expanded={isExpanded ? 'true' : 'false'}
      className={cn(
        'group/canvas cover-background flex flex-col p-0',
        className
      )}
    >
      <div className="h-12 w-full" />
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 h-full w-full"
          >
            <CanvasReveal
              animationSpeed={3}
              containerClassName="cover-background border-none! hidden dark:block"
              colors={[
                [244, 244, 245],
                [228, 228, 231],
              ]}
            />
            <CanvasReveal
              animationSpeed={3}
              containerClassName="cover-background border-none! dark:hidden"
              colors={[
                [24, 24, 27],
                [39, 39, 42],
              ]}
            />
            <div className="bg-background absolute inset-0 mask-[radial-gradient(600px_at_center,white,transparent)]" />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </PanelContent>
  );
}
