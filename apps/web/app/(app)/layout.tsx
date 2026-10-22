import { Suspense } from 'react';

import { CommandMenuDialog } from '@/components/app/command-menu';
import { FadeOverlay } from '@/components/app/fade-overlay';
import { ScrollToTop } from '@/components/app/scroll-to-top';
import { SiteFooter } from '@/components/layout/footer';
import { SiteHeader } from '@/components/layout/header';
import { LayoutState } from '@/components/layout/layout-state';
import { SiteFooterNav } from '@/components/layout/navigation/site-footer-nav';
import { getBlogPosts } from '@/lib/document';
import type { DocPreview } from '@/types/document';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const blogs = getBlogPosts();

  const blogPreviews: DocPreview[] = blogs.map((blog) => ({
    slug: blog.slug,
    title: blog.metadata.title,
    category: blog.metadata.category,
  }));

  return (
    <div
      data-slot="app-layout"
      className="relative isolate flex min-h-dvh flex-col overflow-x-clip"
    >
      <Suspense>
        <LayoutState />
      </Suspense>
      <SiteHeader />
      <CommandMenuDialog blogs={blogPreviews} />
      <main className="flex w-full max-w-screen flex-1 flex-col overflow-x-clip px-3">
        {children}
      </main>
      <ScrollToTop />
      <FadeOverlay align="top" className="max-md:hidden" />
      <FadeOverlay align="bottom" className="md:hidden" />
      <SiteFooterNav />
      <SiteFooter />
    </div>
  );
}
