import { ArrowUpRightIcon } from 'lucide-react';
import Image from 'next/image';

import { GridPattern } from '@/components/app/grid-pattern';
import { AdaptiveRing } from '@/components/ui/adaptive-ring';
import { UTM_PARAMS } from '@/config/site';
import type { SocialProfile } from '@/features/portfolio/types/social-links';
import { cn } from '@/lib/utils';
import { addQueryParams } from '@/utils/url';

type SocialLinkItemProps = SocialProfile & {
  className?: string;
};

export function SocialLinkItem({
  icon,
  title,
  href,
  className,
}: SocialLinkItemProps) {
  return (
    <a
      className={cn(
        'group hover:bg-accent-muted active:bg-accent-muted ease-out-cubic relative flex items-center gap-4 p-4 pr-2 transition-[background-color]',
        className
      )}
      href={addQueryParams(href, UTM_PARAMS)}
      target="_blank"
      rel="noopener"
    >
      <div className="relative size-8 shrink-0">
        <Image
          className="corner-squircle rounded-lg select-none supports-corner-shape:rounded-[50%]"
          src={icon}
          alt={`${title} logo`}
          width={32}
          height={32}
          quality={100}
        />
        <AdaptiveRing className="corner-squircle rounded-lg supports-corner-shape:rounded-[50%]" />
      </div>

      <h3 className="z-1 flex-1 font-medium">{title}</h3>

      <div className="pointer-events-none absolute top-0 right-0 -z-1 size-full overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 size-full mask-[radial-gradient(farthest-side_at_top,white,transparent)]">
          <GridPattern
            className="stroke-border absolute inset-0 size-full"
            height={24}
            width={24}
            x={-14}
            y={8}
          />
        </div>
      </div>

      <ArrowUpRightIcon className="ease-out-cubic text-muted-foreground size-4 transition-[rotate] duration-300 group-hover:rotate-45 group-active:rotate-45" />
    </a>
  );
}
