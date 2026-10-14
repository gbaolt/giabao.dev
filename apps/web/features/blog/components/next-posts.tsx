import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Panel, PanelContent, PanelHeader } from '@/components/app/panel';
import { Button } from '@/components/ui/button';
import type { Doc } from '@/types/document';

import { BlogItem } from './blog-item';

export function NextPosts({ posts }: { posts: Doc[] }) {
  if (posts.length === 0) return null;

  return (
    <section data-slot="next-posts" aria-labelledby="next-posts-title">
      <Panel className="screen-line-bottom-none screen-line-top-none">
        <PanelHeader className="decor-b flex items-center justify-between gap-4 p-2 ps-4">
          <h2
            id="next-posts-title"
            className="text-2xl/none font-medium tracking-tight"
          >
            Continue reading
          </h2>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            className="text-muted-foreground"
            render={<Link href="/blog" />}
          >
            All posts
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </PanelHeader>
        <PanelContent className="px-0">
          <ul className="divide-y border-y">
            {posts.map((post) => (
              <li key={post.slug}>
                <BlogItem blog={post} heading="h3" />
              </li>
            ))}
          </ul>
        </PanelContent>
      </Panel>
    </section>
  );
}
