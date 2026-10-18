import { format } from 'date-fns';
import { CalendarIcon, ChevronRightIcon } from 'lucide-react';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import Link from 'next/link';

import { simpleOgImageUrl } from '@/app/og/params';
import { GridPattern } from '@/components/app/grid-pattern';
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from '@/components/kibo-ui/status';
import { AdaptiveRing } from '@/components/ui/adaptive-ring';
import { Tag } from '@/components/ui/tag';
import { formatReadingTime } from '@/lib/reading-time';
import type { DocSummary } from '@/types/document';

type Heading = 'h2' | 'h3' | 'h4';

export function BlogItem({
  blog,
  heading,
  loading = 'lazy',
}: {
  blog: DocSummary;
  heading?: Heading;
  loading?: ImageProps['loading'];
}) {
  const Heading = heading ?? 'h2';

  const ogImage =
    blog.metadata.image ||
    simpleOgImageUrl(blog.metadata.title, blog.metadata.description);

  return (
    <div className="group/post hover:bg-accent-muted active:bg-accent-muted relative flex items-center overflow-hidden transition-[background-color] ease-out">
      <div
        className="pointer-events-none absolute inset-y-0 left-68 -z-1 w-px bg-[linear-gradient(to_bottom,var(--border)_4px,transparent_2px)] bg-size-[1px_6px] bg-repeat-y max-md:hidden max-sm:hidden"
        aria-hidden
      />

      <div className="p-4 max-md:hidden">
        <div className="relative select-none!">
          <Image
            className="ease-out-cubic aspect-40/21 max-w-60 grayscale transition-[filter] duration-300 group-hover/post:grayscale-0"
            src={ogImage}
            alt={blog.metadata.title}
            width={400}
            height={210}
            loading={loading}
          />
          <AdaptiveRing />
        </div>
      </div>

      <div className="flex w-full flex-col gap-1 p-4">
        <div className="text-muted-foreground mb-2 flex items-center justify-between">
          <dl>
            <dt className="sr-only">Published on</dt>
            <dd className="flex items-center gap-2 text-xs">
              <CalendarIcon className="size-3.5" />
              <time dateTime={new Date(blog.metadata.createdAt).toISOString()}>
                {format(new Date(blog.metadata.createdAt), 'MMMM dd, yyyy')}
              </time>
            </dd>
          </dl>

          <span className="group-hover/post:text-foreground flex items-center gap-1.5 pb-0.5 text-sm transition-colors">
            Read more
            <ChevronRightIcon className="size-4" />
          </span>
        </div>

        <Heading className="text-lg leading-snug font-medium text-pretty">
          <Link
            href={`/blog/${blog.slug}`}
            aria-label={`Read ${blog.metadata.title}`}
            prefetch={true}
          >
            <span className="absolute inset-0" aria-hidden />
            {blog.metadata.title}
          </Link>

          {(blog.metadata.new || blog.metadata.updated) && (
            <Status
              status="maintenance"
              className="ml-1 inline-block bg-transparent pt-2"
            >
              <StatusIndicator />
              <StatusLabel className="sr-only">
                {blog.metadata.new ? ' (New)' : ' (Updated)'}
              </StatusLabel>
            </Status>
          )}
        </Heading>

        <p className="text-muted-foreground text-sm text-pretty">
          {blog.metadata.description}
        </p>

        <div className="text-muted-foreground mt-2 flex items-start gap-3 text-sm">
          <span className="flex h-5 items-center gap-2 text-nowrap">
            {blog.metadata.author && <span>{blog.metadata.author}</span>}
            <span>•</span>
            {blog.metadata.duration != null && (
              <span>{formatReadingTime(blog.metadata.duration)}</span>
            )}
          </span>
          {blog.metadata.tags && blog.metadata.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {blog.metadata.tags.map((tag, index) => (
                <li key={index} className="flex">
                  <Tag>{tag}</Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute top-0 left-1/2 -z-1 size-full mask-[radial-gradient(farthest-side_at_top,white,transparent)]">
        <GridPattern
          className="stroke-border absolute inset-0 size-full"
          height={25}
          width={25}
          x={22}
          y={-1}
        />
      </div>
    </div>
  );
}
