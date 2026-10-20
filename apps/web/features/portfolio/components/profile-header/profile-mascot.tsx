'use client';

import { useRef } from 'react';

import { Mascot } from '@/components/app/mascot';
import { useView } from '@/hooks/use-view';
import { drop004Sound } from '@/lib/soundcn/drop-004';
import { playSound } from '@/lib/soundcn/sound-engine';

import styles from '../../styles/profile-mascot-background.module.css';

function playReactionSound() {
  void playSound(drop004Sound.dataUri, { volume: 0.2 }).catch(() => {});
}

export function ProfileMascot() {
  const ref = useRef<HTMLDivElement>(null);
  const { isPageInView, isInView } = useView(ref);

  return (
    <div ref={ref} className="relative size-full">
      <ProfileMascotBackground />
      <Mascot
        directions="https://assets.giabao.dev/mascots/gbaolt-directions.webp"
        reactions="https://assets.giabao.dev/mascots/gbaolt-reactions.webp"
        active={isPageInView && isInView}
        label="Gia Bảo pixel avatar"
        size={160}
        className="ring-border ring-offset-background focus-visible:outline-ring/50 size-full! overflow-hidden rounded-full ring-1 ring-offset-2 [image-rendering:pixelated] focus-visible:outline-offset-2 [&>span]:origin-center! [&>span]:translate-y-[6%] [&>span]:scale-[1.12]"
        onClick={playReactionSound}
      />
    </div>
  );
}

function ProfileMascotBackground() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 80 80"
      shapeRendering="crispEdges"
      className={`${styles.scene} pointer-events-none absolute inset-0 size-full rounded-full`}
    >
      <path fill="var(--sky)" d="M0 0h80v80H0z" />

      <g className="dark:hidden">
        <path fill="var(--sun)" d="M58 10h8v2h2v8h-2v2h-8v-2h-2v-8h2z" />
        <path
          fill="var(--cloud)"
          d="M8 22h4v-4h8v2h6v4h4v4H4v-4h4zM62 34h6v-4h8v4h4v6H58v-4h4z"
        />
        <path fill="var(--cloud-shade)" d="M4 28h26v2H4zM58 40h22v2H58z" />
      </g>

      <g className="hidden dark:block">
        <path
          fill="var(--moon)"
          d="M60 10h6v2h-4v8h6v-2h2v4h-2v2h-8v-2h-2V12h2z"
        />
        <path
          fill="var(--star)"
          d="M18 12h2v2h-2zM32 6h2v2h-2zM10 34h2v2h-2zM72 28h2v2h-2zM48 14h2v2h-2zM22 26h2v2h-2z"
        />
        <path fill="var(--moon)" d="M12 20h2v2h2v2h-2v2h-2v-2h-2v-2h2z" />
      </g>

      <path
        fill="var(--distant-hills)"
        d="M0 50h6v-4h6v-4h8v-4h10v4h6v4h10v4h6v-4h6v-4h10v4h6v4h6v30H0z"
      />
      <path
        fill="var(--near-hills)"
        d="M0 60h8v-4h12v4h8v4h18v-4h8v-4h8v-4h12v4h6v24H0z"
      />
    </svg>
  );
}
