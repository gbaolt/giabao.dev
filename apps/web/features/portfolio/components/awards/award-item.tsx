import { format } from 'date-fns';
import { AwardIcon } from 'lucide-react';

import { GridPattern } from '@/components/app/grid-pattern';
import { IntroItemIcon } from '@/components/app/intro-item';
import { Markdown } from '@/components/app/markdown';
import {
  Collapsible,
  CollapsibleChevronsIcon,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { UTM_PARAMS } from '@/config/site';
import type { Award } from '@/features/portfolio/types/awards';
import { addQueryParams } from '@/utils/url';

import { AwardReference } from './awared-reference';

export function AwardItem({
  className,
  award,
}: {
  className?: string;
  award: Award;
}) {
  const canExpand = !!award.description;

  return (
    <Collapsible
      className={className}
      disabled={!canExpand}
      defaultOpen={award.isExpanded}
    >
      <div className="hover:bg-accent-muted active:bg-accent-muted my-auto flex items-center transition-colors">
        <IntroItemIcon size="lg" className="mx-4">
          <AwardIcon />
        </IntroItemIcon>

        <div className="border-border relative flex-1 overflow-hidden border-l border-dashed">
          <CollapsibleTrigger className="flex w-full items-center gap-2 p-4 pr-2 text-left">
            <div className="z-1 flex-1">
              <h3 className="mb-1 leading-snug font-medium text-balance">
                {award.title}
              </h3>

              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <dl>
                  <dt className="sr-only">Prize</dt>
                  <dd>{award.prize}</dd>
                </dl>

                <Separator
                  className="data-vertical:h-4 data-vertical:self-center"
                  orientation="vertical"
                />

                <dl>
                  <dt className="sr-only">Awarded in</dt>
                  <dd>
                    <time dateTime={new Date(award.date).toISOString()}>
                      {format(new Date(award.date), 'MM.yyyy')}
                    </time>
                  </dd>
                </dl>

                <Separator
                  className="data-vertical:h-4 data-vertical:self-center"
                  orientation="vertical"
                />

                <dl>
                  <dt className="sr-only">Received in Grade</dt>
                  <dd>{award.grade}</dd>
                </dl>
              </div>
            </div>

            {award.referenceLink && (
              <AwardReference
                href={addQueryParams(award.referenceLink, UTM_PARAMS)}
              />
            )}

            {canExpand && (
              <div className="text-muted-foreground z-1 shrink-0 [&_svg]:size-4">
                <CollapsibleChevronsIcon />
              </div>
            )}
          </CollapsibleTrigger>

          <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 size-full mask-[radial-gradient(farthest-side_at_top,white,transparent)]">
            <GridPattern
              className="stroke-border absolute inset-0 size-full"
              height={25}
              width={25}
              x={-2}
              y={7}
            />
          </div>
        </div>
      </div>

      {canExpand && (
        <CollapsibleContent>
          <div className="typeset typeset-description border-border border-t p-4">
            <Markdown>{award.description}</Markdown>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
