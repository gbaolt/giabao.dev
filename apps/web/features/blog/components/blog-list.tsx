import { FileTextIcon, SearchXIcon } from 'lucide-react';

import { Panel } from '@/components/app/panel';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { DocSummary } from '@/types/document';

import { BlogItem } from './blog-item';

export function BlogListEmpty() {
  return (
    <BlogListEmptyState
      icon={<FileTextIcon />}
      title="No posts yet."
      description="Nothing has been published here."
    />
  );
}

export function BlogListNoResults() {
  return (
    <BlogListEmptyState
      icon={<SearchXIcon />}
      title="No posts found."
      description="Try a different search, or clear the query and tag filters."
    />
  );
}

export function BlogList({
  blogs,
  empty = <BlogListEmpty />,
}: {
  blogs: DocSummary[];
  empty?: React.ReactNode;
}) {
  const isEmpty = blogs.length === 0;

  return (
    <Panel className="screen-line-bottom-none decor-t h-full flex-1 py-4">
      {isEmpty ? (
        empty
      ) : (
        <ul className="flex flex-col border-y">
          {blogs.map((blog, index) => (
            <li
              key={blog.slug}
              className="group border-b last:border-b-0 last:border-none"
            >
              <BlogItem blog={blog} loading={index <= 3 ? 'eager' : 'lazy'} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BlogListEmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
