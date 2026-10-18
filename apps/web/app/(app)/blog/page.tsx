import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { Blog, WithContext } from 'schema-dts';

import { simpleOgImageUrl } from '@/app/og/params';
import { jsonLdBreadcrumbList, JsonLdScript } from '@/components/json-ld';
import { AppShell } from '@/components/layout/app-shell';
import { JSON_LD_ID } from '@/config/json-ld';
import { X_PROFILE } from '@/config/site';
import { BlogList } from '@/features/blog/components/blog-list';
import { BlogListFiltered } from '@/features/blog/components/blog-list-filtered';
import { BlogSearchInput } from '@/features/blog/components/blog-search-input';
import { SearchInput } from '@/features/blog/components/search-input';
import { getBlogPosts } from '@/lib/document';
import { absoluteUrl } from '@/lib/utils';

const title = 'Dev Blog';
const description =
  'Ideas, experiments, and insights from my journey as a developer.';

const ogImage = simpleOgImageUrl(title, description);

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    url: '/blog',
    type: 'website',
    images: {
      url: ogImage,
      width: 1200,
      height: 630,
      alt: title,
    },
  },
  twitter: {
    card: 'summary_large_image',
    site: X_PROFILE,
    creator: X_PROFILE,
    images: [ogImage],
  },
};

function getBlogJsonLd(
  blogs: { slug: string; metadata: { title: string; createdAt: string } }[]
): WithContext<Blog> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': absoluteUrl('/blog'),
    name: title,
    description,
    url: absoluteUrl('/blog'),
    isPartOf: { '@id': JSON_LD_ID.website },
    blogPost: blogs.map((blog) => ({
      '@type': 'BlogPosting',
      '@id': absoluteUrl(`/blog/${blog.slug}`),
      headline: blog.metadata.title,
      url: absoluteUrl(`/blog/${blog.slug}`),
      datePublished: new Date(blog.metadata.createdAt).toISOString(),
    })),
  };
}

export default function BlogsPage() {
  const blogPosts = getBlogPosts().map(({ slug, metadata }) => ({
    slug,
    metadata,
  }));
  const tagCounts = new Map<string, number>();

  for (const post of blogPosts) {
    for (const tag of new Set(post.metadata.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = Array.from(tagCounts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => a.tag.localeCompare(b.tag)
  );

  return (
    <div className="flex w-full flex-1 flex-col">
      <JsonLdScript data={getBlogJsonLd(blogPosts)} />

      <JsonLdScript
        data={jsonLdBreadcrumbList([
          { name: 'Home', href: '/' },
          { name: 'Blog', href: '/blog' },
        ])}
      />

      <AppShell
        title={title}
        description={description}
        className="md:max-w-4xl"
      >
        <div className="border-x p-2">
          <Suspense fallback={<SearchInput />}>
            <BlogSearchInput tags={tags} />
          </Suspense>
        </div>

        <Suspense fallback={<BlogList blogs={blogPosts} />}>
          <BlogListFiltered blogs={blogPosts} />
        </Suspense>
      </AppShell>
    </div>
  );
}
