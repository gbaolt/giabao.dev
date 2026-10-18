'use client';

import { Mascot } from 'page-mascot';

export function ProfileMascot() {
  return (
    <Mascot
      directions="https://assets.giabao.dev/mascots/gbaolt-directions.webp?t=1792338837"
      reactions="https://assets.giabao.dev/mascots/gbaolt-reactions.webp?t=1792338837"
      label="Gia Bảo pixel avatar"
      size={160}
      className="ring-border ring-offset-background focus-visible:outline-ring/50 size-full! overflow-hidden rounded-full ring-1 ring-offset-2 [image-rendering:pixelated] focus-visible:outline-offset-2 [&>span]:origin-center! [&>span]:translate-y-[6%] [&>span]:scale-[1.12]"
    />
  );
}
