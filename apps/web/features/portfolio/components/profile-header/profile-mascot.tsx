'use client';

import { Mascot } from '@/components/app/mascot';
import { drop004Sound } from '@/lib/soundcn/drop-004';
import { playSound } from '@/lib/soundcn/sound-engine';

function playReactionSound() {
  void playSound(drop004Sound.dataUri, { volume: 0.3 }).catch(() => {});
}

export function ProfileMascot() {
  return (
    <Mascot
      directions="https://assets.giabao.dev/mascots/gbaolt-directions.webp?t=1792381430"
      reactions="https://assets.giabao.dev/mascots/gbaolt-reactions.webp?t=1792451700"
      label="Gia Bảo pixel avatar"
      size={160}
      className="ring-border ring-offset-background focus-visible:outline-ring/50 size-full! overflow-hidden rounded-full ring-1 ring-offset-2 [image-rendering:pixelated] focus-visible:outline-offset-2 [&>span]:origin-center! [&>span]:translate-y-[6%] [&>span]:scale-[1.12]"
      onClick={playReactionSound}
    />
  );
}
