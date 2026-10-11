import { format } from 'date-fns';
import { getTableOfContents } from 'fumadocs-core/content/toc';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { cacheLife } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BlogPosting, WithContext } from 'schema-dts';

import { simpleOgImageUrl } from '@/app/og/params';
import { FadeOverlay } from '@/components/app/fade-overlay';
import { FullWidthDivider } from '@/components/app/full-width-divider';
import { MDCopyButtonGroup } from '@/components/app/page-actions';
import { Panel, PanelContent, PanelHeader } from '@/components/app/panel';
import { ShareMenu } from '@/components/app/share-menu';
import { StripeSeparator } from '@/components/app/stripe-separator';
import { jsonLdBreadcrumbList, JsonLdScript } from '@/components/json-ld';
import { MDX } from '@/components/mdx';
import { TOCInline } from '@/components/toc/toc-inline';
import { TOCMinimap } from '@/components/toc/toc-minimap';
import { AdaptiveRing } from '@/components/ui/adaptive-ring';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Prose } from '@/components/ui/typography';
import { JSON_LD_ID } from '@/config/json-ld';
import { X_PROFILE } from '@/config/site';
import { DocKeyboardShortcuts } from '@/features/blog/components/doc/doc-keyboard-shorcuts';
import {
  DocContainer,
  DocContentCol,
  DocGrid,
  DocLeftCol,
  DocRightCol,
} from '@/features/blog/components/doc/doc-layout';
import { DocPageRoot } from '@/features/blog/components/doc/doc-page-root';
import {
  BLOG_CATEGORY,
  findNeighbour,
  getBlogPosts,
  getDocBySlug,
} from '@/lib/document';
import { formatReadingTime } from '@/lib/reading-time';
import { absoluteUrl } from '@/lib/utils';
import type { Doc } from '@/types/document';

export function generateStaticParams() {
  const blogs = getBlogPosts();
  return blogs.map((blog) => ({ slug: blog.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  'use cache';
  cacheLife('max');

  const { slug } = await params;
  const blog = getDocBySlug(slug, BLOG_CATEGORY);

  if (!blog) notFound();

  const { title, description, image, createdAt, updatedAt } = blog.metadata;

  const blogUrl = `/blog/${blog.slug}`;
  const ogImage = image ?? simpleOgImageUrl(title, description);

  return {
    title,
    description,
    alternates: {
      canonical: blogUrl,
    },
    openGraph: {
      url: blogUrl,
      type: 'article',
      publishedTime: new Date(createdAt).toISOString(),
      modifiedTime: new Date(updatedAt).toISOString(),
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
}

function getPageJsonLd(blog: Doc): WithContext<BlogPosting> {
  const blogUrl = `/blog/${blog.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': absoluteUrl(blogUrl),
    headline: blog.metadata.title,
    description: blog.metadata.description,
    image:
      blog.metadata.image ??
      absoluteUrl(
        simpleOgImageUrl(blog.metadata.title, blog.metadata.description)
      ),
    url: absoluteUrl(blogUrl),
    datePublished: new Date(blog.metadata.createdAt).toISOString(),
    dateModified: new Date(blog.metadata.updatedAt).toISOString(),
    author: { '@id': JSON_LD_ID.person },
    mainEntityOfPage: absoluteUrl(blogUrl),
    isPartOf: {
      '@type': 'Blog',
      '@id': absoluteUrl('/blog'),
      name: 'Blog',
      url: absoluteUrl('/blog'),
    },
  };
}

export default async function BlogPage({ params }: PageProps<'/blog/[slug]'>) {
  'use cache';
  cacheLife('max');

  const { slug } = await params;
  const blog = getDocBySlug(slug, BLOG_CATEGORY);

  if (!blog) notFound();

  const toc = getTableOfContents(blog.content);

  const { previous, next } = findNeighbour(getBlogPosts(), slug);

  return (
    <>
      <JsonLdScript data={getPageJsonLd(blog)} />
      <JsonLdScript
        data={jsonLdBreadcrumbList([
          {
            name: 'Home',
            href: '/',
          },
          {
            name: 'Blog',
            href: '/blog',
          },
          {
            name: blog.metadata.title,
            href: `/blog/${slug}`,
          },
        ])}
      />

      <DocKeyboardShortcuts
        previous={previous ? (`/blog/${previous.slug}` as Route) : null}
        next={next ? (`/blog/${next.slug}` as Route) : null}
      />

      <DocPageRoot data-slot="doc-page" className="flex flex-1 flex-col">
        <div className="mx-auto h-12 w-full max-w-4xl border-x" />
        <DocContainer>
          <Panel className="decor-t screen-line-bottom-none flex items-center justify-between p-2">
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              className="text-muted-foreground gap-1.5 text-base tracking-wider"
              render={<Link href="/blog" />}
            >
              <ArrowLeftIcon data-icon="inline-start" className="size-4" />
              Blog
            </Button>

            <div className="flex items-center gap-2">
              <MDCopyButtonGroup markdownUrl={`/blog/${blog.slug}.md`} />
              <ShareMenu
                title={blog.metadata.title}
                url={`/blog/${blog.slug}`}
              />

              {previous && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={`/blog/${previous.slug}`}
                            aria-label="Previous post"
                          >
                            <ArrowLeftIcon />
                          </Link>
                        }
                      />
                    }
                  />
                  <TooltipContent className="pr-2 pl-3">
                    <div className="flex items-center gap-3">
                      Previous post
                      <Kbd>
                        <ArrowLeftIcon />
                      </Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {next && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={`/blog/${next.slug}`}
                            aria-label="Next post"
                          >
                            <ArrowRightIcon />
                          </Link>
                        }
                      />
                    }
                  />
                  <TooltipContent className="pr-2 pl-3">
                    <div className="flex items-center gap-3">
                      Next post
                      <Kbd>
                        <ArrowRightIcon />
                      </Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </Panel>

          <StripeSeparator />
        </DocContainer>

        <DocGrid className="flex-1 grid-rows-1">
          <DocLeftCol />

          <DocContentCol className="flex h-full flex-col">
            <div
              data-slot="doc-og-image"
              className="relative w-full border-x p-4"
            >
              <div className="pointer-events-none absolute inset-x-4 inset-y-0 -z-1 border-x" />
              <FullWidthDivider className="top-4" contained />
              <FullWidthDivider className="bottom-4" contained />
              <div className="relative aspect-40/21 w-full select-none">
                <Image
                  className="ease-out-cubic grayscale transition-[filter] duration-300 hover:grayscale-0"
                  src={
                    blog.metadata.image ??
                    simpleOgImageUrl(
                      blog.metadata.title,
                      blog.metadata.description
                    )
                  }
                  alt={blog.metadata.title}
                  width={1200}
                  height={630}
                  priority
                />
                <AdaptiveRing />
              </div>
            </div>

            <StripeSeparator />

            <Panel className="decor-t screen-line-bottom-none screen-line-top-none z-0 flex flex-1 flex-col p-0">
              <PanelHeader className="decor-b py-2">
                <h1 className="screen-line-bottom-none text-4xl font-medium tracking-tight text-balance">
                  {blog.metadata.title}
                </h1>
                <p className="text-muted-foreground py-1 text-base">
                  {blog.metadata.description}
                </p>
              </PanelHeader>

              <PanelContent className="p-0">
                <div className="text-muted-foreground not-typeset mb-(--typeset-flow) flex items-center justify-between gap-1 border-b px-4 py-3 max-sm:flex-col max-sm:items-start">
                  {blog.metadata.author && (
                    <span className="text-foreground flex items-center gap-2 text-base">
                      <Avatar className="size-6">
                        <AvatarImage src={blog.metadata.avatar} />
                        <AvatarFallback>
                          {blog.metadata.author.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {blog.metadata.author}
                    </span>
                  )}
                  <span className="flex items-center gap-2 text-sm max-sm:ml-8">
                    <time
                      dateTime={new Date(blog.metadata.createdAt).toISOString()}
                      aria-label="Published on"
                    >
                      {format(
                        new Date(blog.metadata.createdAt),
                        'MMMM dd, yyyy'
                      )}
                    </time>
                    <span>•</span>
                    {blog.metadata.duration != null && (
                      <span>{formatReadingTime(blog.metadata.duration)}</span>
                    )}
                  </span>
                </div>
                <Prose className="p-4">
                  <TOCInline className="md:hidden" items={toc} />

                  <div>
                    <MDX content={blog.content} />
                  </div>
                </Prose>
              </PanelContent>
            </Panel>

            <TOCMinimap items={toc} />
          </DocContentCol>

          <DocRightCol />
        </DocGrid>
      </DocPageRoot>

      <StripeSeparator />
      <FadeOverlay align="bottom" className="max-md:hidden" />
    </>
  );
}
