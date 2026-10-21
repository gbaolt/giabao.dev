import { InfinityIcon } from 'lucide-react';

import { IntroItemIcon } from '@/components/app/intro-item';
import { Markdown } from '@/components/app/markdown';
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from '@/components/kibo-ui/status';
import {
  Collapsible,
  CollapsibleChevronsIcon,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tag } from '@/components/ui/tag';
import type { ExperiencePosition } from '@/features/portfolio/types/experiences';
import { cn } from '@/lib/utils';

import { ExperienceIcon } from './position-icon';

export function ExperiencePositionItem({
  position,
}: {
  position: ExperiencePosition;
}) {
  const { start, end } = position.employmentPeriod;
  const isOngoing = !end;

  return (
    <Collapsible
      className="before:bg-border relative before:absolute before:top-3 before:-bottom-8 before:left-3 before:w-px last:before:absolute last:before:h-full last:before:w-4 last:before:content-none"
      defaultOpen={position.isExpanded}
      disabled={!position.description}
    >
      <CollapsibleTrigger
        className={cn(
          'group block w-full text-left',
          'hover:before:bg-accent-muted active:before:bg-accent-muted before:ease-out-cubic relative before:absolute before:-top-1 before:-right-1 before:-bottom-1.5 before:left-7 before:-z-1 before:mx-1 before:rounded-lg before:transition-[background-color]',
          'focus-visible:before:ring-ring/50 outline-none focus-visible:before:ring-2 focus-visible:before:ring-inset',
          'data-disabled:before:content-none'
        )}
      >
        <div className="relative z-1 mb-1 flex items-center gap-3">
          <IntroItemIcon>
            <ExperienceIcon icon={position.icon} />
          </IntroItemIcon>

          <div className="mx-1 flex min-w-0 flex-1 items-center gap-1">
            <Label className="self-start text-base font-medium text-pretty">
              {position.title}
            </Label>
            {position.isCurrentPosition && (
              <Status status="maintenance" className="bg-transparent">
                <StatusIndicator />
                <StatusLabel className="sr-only">Current Position</StatusLabel>
              </Status>
            )}
          </div>

          <div className="text-muted-foreground mx-1 ml-auto shrink-0 group-data-disabled:hidden [&_svg]:size-4">
            <CollapsibleChevronsIcon />
          </div>
        </div>

        <div className="text-muted-foreground mx-1 flex items-center gap-2 pl-9 text-sm">
          {position.employmentType && (
            <>
              <dl>
                <dt className="sr-only">Employment Type</dt>
                <dd>{position.employmentType}</dd>
              </dl>

              <Separator
                className="data-vertical:h-4 data-vertical:self-center"
                orientation="vertical"
              />
            </>
          )}

          <dl>
            <dt className="sr-only">Employment Period</dt>
            <dd className="flex items-center gap-0.5">
              <span>{start}</span>
              <span className="font-mono">—</span>
              {isOngoing ? (
                <>
                  <InfinityIcon className="size-4.5 translate-y-[0.5px]" />
                  <span className="sr-only">Present</span>
                </>
              ) : (
                <span>{end}</span>
              )}
            </dd>
          </dl>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {position.description && (
          <div className="typeset typeset-description pt-3 pb-1 pl-9">
            <Markdown>{position.description}</Markdown>
          </div>
        )}
      </CollapsibleContent>

      {Array.isArray(position.skills) && position.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-3 pl-9">
          {position.skills.map((skill, index) => (
            <li key={index} className="flex">
              <Tag>{skill}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Collapsible>
  );
}
