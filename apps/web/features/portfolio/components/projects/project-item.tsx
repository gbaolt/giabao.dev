import { BoxIcon, InfinityIcon } from 'lucide-react';
import Image from 'next/image';

import { GridPattern } from '@/components/app/grid-pattern';
import { IntroItemIcon } from '@/components/app/intro-item';
import { Markdown } from '@/components/app/markdown';
import {
  Collapsible,
  CollapsibleChevronsIcon,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tag } from '@/components/ui/tag';
import { UTM_PARAMS } from '@/config/site';
import type { Project } from '@/features/portfolio/types/projects';
import { cn } from '@/lib/utils';
import { addQueryParams } from '@/utils/url';

import { ProjectLink } from './project-link';

export function ProjectItem({
  className,
  project,
}: {
  className?: string;
  project: Project;
}) {
  const { start, end } = project.period;
  const isOngoing = !end;
  const isSinglePeriod = end === start;

  return (
    <Collapsible
      className={cn('mx-2 mt-2', className)}
      defaultOpen={project.isExpanded}
    >
      <div className="hover:bg-muted-accent active:bg-muted-accent bg-accent/50 dark:bg-muted/20 flex items-stretch rounded-lg border transition-colors">
        {project.logo ? (
          <div className="bg-background m-1.5 mr-0 flex items-center rounded-md border">
            <Image
              src={project.logo}
              alt={project.title}
              width={32}
              height={32}
              quality={100}
              className="mx-3 flex size-8 shrink-0 select-none"
              unoptimized
              aria-hidden
            />
          </div>
        ) : (
          <div className="bg-background m-1.5 mr-0 flex items-center rounded-md border">
            <IntroItemIcon size="xl" className="mx-3">
              <BoxIcon />
            </IntroItemIcon>
          </div>
        )}

        <div className="border-border relative flex-1 overflow-hidden border-dashed">
          <CollapsibleTrigger className="no-focus flex w-full items-center gap-2 p-4 pr-2 text-left">
            <div className="z-1 flex-1">
              <h3 className="mb-1 leading-snug font-medium text-balance">
                {project.title}
              </h3>

              <dl className="text-muted-foreground text-sm">
                <dt className="sr-only">Period</dt>
                <dd className="flex items-center gap-0.5">
                  <span>{start}</span>
                  {!isSinglePeriod && (
                    <>
                      <span className="font-mono">—</span>
                      {isOngoing ? (
                        <>
                          <InfinityIcon className="size-4.5 translate-y-[0.5px]" />
                          <span className="sr-only">Present</span>
                        </>
                      ) : (
                        <span>{end}</span>
                      )}
                    </>
                  )}
                </dd>
              </dl>
            </div>

            <ProjectLink href={addQueryParams(project.link, UTM_PARAMS)} />

            <div className="text-muted-foreground z-1 shrink-0 [&_svg]:size-4">
              <CollapsibleChevronsIcon />
            </div>
          </CollapsibleTrigger>

          <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 size-full mask-[radial-gradient(farthest-side_at_top,white,transparent)]">
            <GridPattern
              className="stroke-border absolute inset-0 size-full"
              height={25}
              width={25}
              x={12}
              y={7}
            />
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-4 px-4 py-2">
          {project.description && (
            <div className="typeset typeset-description">
              <Markdown>{project.description}</Markdown>
            </div>
          )}

          {project.skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {project.skills.map((skill, index) => (
                <li key={index} className="flex">
                  <Tag>{skill}</Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
