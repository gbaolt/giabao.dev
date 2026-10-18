import { PanelContent } from '@/components/app/panel';
import { VerifiedIcon } from '@/components/icons/verified-icon';
import { AdaptiveRing } from '@/components/ui/adaptive-ring';
import { Label } from '@/components/ui/label';
import { USER } from '@/features/portfolio/data/user';

import { FlipSentences } from './flip-sentences';
import { ProfileMascot } from './profile-mascot';
import { ProfileStatus } from './profile-status';

export function ProfileInfo() {
  return (
    <PanelContent className="border-border decor-all flex border-x p-0">
      <PanelContent className="border-border shrink-0 border-r p-0">
        <div className="relative mx-0.5 my-0.75 size-32 sm:size-40">
          <ProfileMascot />
          <AdaptiveRing className="rounded-full" />
        </div>

        <ProfileStatus
          emoji="😴"
          quote="Focusing, don't let the emoji fool you"
        />
      </PanelContent>

      <div className="flex flex-1 flex-col">
        <div className="flex grow items-end pb-1 pl-4">
          <p
            className="font-pixel line-clamp-1 text-xs text-zinc-400 select-none dark:hidden"
            aria-hidden
          >
            text-zinc-400 font-pixel
          </p>
          <p
            className="font-pixel line-clamp-1 hidden text-xs text-zinc-600 select-none dark:block"
            aria-hidden
          >
            text-zinc-600 font-pixel
          </p>
        </div>

        <div className="border-border border-t">
          <div className="flex flex-wrap items-center pl-4">
            <div className="mr-2 flex items-center gap-2 py-1">
              <h1 className="-translate-y-px truncate text-3xl leading-none font-semibold tracking-tight">
                {USER.displayName}
              </h1>

              <VerifiedIcon
                className="text-info size-4.5 py-0 select-none"
                aria-label="Verified"
              />
            </div>

            <Label className="text-muted-foreground text-lg leading-none font-light">
              @{USER.username}
            </Label>
          </div>

          <FlipSentences className="border-border border-t py-1 pl-4">
            {USER.flipSentences}
          </FlipSentences>
        </div>
      </div>
    </PanelContent>
  );
}
