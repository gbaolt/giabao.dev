'use client';

import { YES_DEFAULTS } from 'create-gb-app/preset';
import { RotateCcwIcon, ShuffleIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ShareMenu } from '@/components/app/share-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { shuffleConfiguration } from '../lib/shuffle-configuration';
import { useCreate } from './create-provider';
import { CreateSetupGuide } from './create-setup-guide';

export function CreateActions() {
  const { flags, projectName, setFlags } = useCreate();

  const changeConfiguration = (next: typeof flags, message: string) => {
    const previous = { ...flags };
    setFlags(next);
    toast.success(message, {
      action: {
        label: 'Undo',
        onClick: () => setFlags(previous),
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between p-3 max-xl:border-b">
      <CreateSetupGuide />
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() =>
                  changeConfiguration(YES_DEFAULTS, 'Configuration reset')
                }
              >
                <RotateCcwIcon />
              </Button>
            }
          />
          <TooltipContent>Reset configuration</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() =>
                  changeConfiguration(
                    shuffleConfiguration(flags),
                    'Configuration shuffled'
                  )
                }
              >
                <ShuffleIcon />
              </Button>
            }
          />
          <TooltipContent>Shuffle stack</TooltipContent>
        </Tooltip>
        <ShareMenu
          variant="outline"
          title="Create configuration"
          url="/create"
          getUrl={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('name', projectName);
            return url.href;
          }}
        />
      </div>
    </div>
  );
}
