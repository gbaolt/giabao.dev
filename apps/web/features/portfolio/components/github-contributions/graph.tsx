'use client';

import { format } from 'date-fns';
import { use, useState } from 'react';

import type { Activity } from '@/components/kibo-ui/contribution-graph';
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from '@/components/kibo-ui/contribution-graph';
import { Spinner } from '@/components/ui/spinner';
import {
  createTooltipHandle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GITHUB_PROFILE, UTM_PARAMS } from '@/config/site';
import { useBreakpoints } from '@/hooks/use-breakpoint';
import { useMounted } from '@/hooks/use-mounted';
import { cn } from '@/lib/utils';
import { addQueryParams } from '@/utils/url';

export function GitHubContributionGraph({
  contributions,
}: {
  contributions: Promise<Activity[]>;
}) {
  const resolvedContributions = use(contributions);
  const data = Array.isArray(resolvedContributions)
    ? resolvedContributions
    : [];
  const { xs, sm, md, lg, xl } = useBreakpoints(['xs', 'sm', 'md', 'lg', 'xl']);
  const mounted = useMounted();
  const [tooltipHandle] = useState(() => createTooltipHandle<Activity>());

  const sizes: [boolean, number][] = [
    [xs, 8],
    [sm, 9],
    [md, 11],
    [lg, 12],
    [xl, 13],
  ];

  const blockSize = mounted
    ? (sizes.find(([condition]) => condition)?.[1] ?? 13)
    : 13;
  const blockMargin = mounted ? (md ? 2 : 3) : 3;
  const blockRadius = mounted ? (md ? 2 : 3) : 3;
  const fontSize = mounted ? (md ? 11 : lg ? 13 : 14) : 14;

  return (
    <ContributionGraph
      className="mx-auto py-2"
      data={data}
      fontSize={fontSize}
      blockSize={blockSize}
      blockMargin={blockMargin}
      blockRadius={blockRadius}
    >
      <TooltipProvider delay={300}>
        <ContributionGraphCalendar className="no-scrollbar px-2">
          {({
            activity,
            dayIndex,
            weekIndex,
            tabIndex,
            onFocus,
            onKeyDown,
          }) => (
            <TooltipTrigger
              handle={tooltipHandle}
              payload={activity}
              render={
                <g
                  role="gridcell"
                  aria-colindex={weekIndex + 1}
                  tabIndex={tabIndex}
                  onFocus={onFocus}
                  onKeyDown={onKeyDown}
                  data-date={activity.date}
                  className="focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              }
              aria-label={`${activity.count} contributions on ${format(new Date(activity.date), 'dd.MM.yyyy')}`}
            >
              <ContributionGraphBlock
                activity={activity}
                dayIndex={dayIndex}
                weekIndex={weekIndex}
                className={cn(
                  'data-[level="0"]:fill-[#ebedf0] dark:data-[level="0"]:fill-[#161b22]',
                  'data-[level="1"]:fill-[#9be9a8] dark:data-[level="1"]:fill-[#0e4429]',
                  'data-[level="2"]:fill-[#40c463] dark:data-[level="2"]:fill-[#006d32]',
                  'data-[level="3"]:fill-[#30a14e] dark:data-[level="3"]:fill-[#26a641]',
                  'data-[level="4"]:fill-[#216e39] dark:data-[level="4"]:fill-[#39d353]'
                )}
              />
            </TooltipTrigger>
          )}
        </ContributionGraphCalendar>
        <Tooltip handle={tooltipHandle}>
          {({ payload: activity }) =>
            activity && (
              <TooltipContent className="font-sans">
                <p>
                  {activity.count} contribution
                  {activity.count > 1 ? 's' : null} on{' '}
                  {format(new Date(activity.date), 'dd.MM.yyyy')}
                </p>
              </TooltipContent>
            )
          }
        </Tooltip>
      </TooltipProvider>

      <ContributionGraphFooter className="px-2">
        <ContributionGraphTotalCount>
          {({ totalCount }) => (
            <div className="text-muted-foreground">
              {totalCount.toLocaleString('en')} contributions on{' '}
              <a
                className="link-underline text-foreground font-medium"
                href={addQueryParams(
                  `https://github.com/${GITHUB_PROFILE}`,
                  UTM_PARAMS
                )}
                target="_blank"
                rel="noopener"
              >
                GitHub
              </a>{' '}
              last year.
            </div>
          )}
        </ContributionGraphTotalCount>

        <ContributionGraphLegend
          levelClassName={cn(
            'data-[level="0"]:fill-[#ebedf0] dark:data-[level="0"]:fill-[#161b22]',
            'data-[level="1"]:fill-[#9be9a8] dark:data-[level="1"]:fill-[#0e4429]',
            'data-[level="2"]:fill-[#40c463] dark:data-[level="2"]:fill-[#006d32]',
            'data-[level="3"]:fill-[#30a14e] dark:data-[level="3"]:fill-[#26a641]',
            'data-[level="4"]:fill-[#216e39] dark:data-[level="4"]:fill-[#39d353]'
          )}
        />
      </ContributionGraphFooter>
    </ContributionGraph>
  );
}

export function GitHubContributionFallback() {
  return (
    <div className="flex h-44 w-full flex-col items-center justify-center gap-2">
      <Spinner className="size-4" />
      <span className="text-muted-foreground">Loading contributions…</span>
    </div>
  );
}
