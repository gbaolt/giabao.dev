import dynamic from 'next/dynamic';
import { Suspense } from 'react';

import { FadeOverlay } from '@/components/app/fade-overlay';
import { SiteFooter } from '@/components/layout/footer';
import { SiteHeader } from '@/components/layout/header';
import { LayoutState } from '@/components/layout/layout-state';
import { NavigationPrefetchProvider } from '@/components/layout/navigation/navigation-prefetch';
import { SiteFooterNav } from '@/components/layout/navigation/site-footer-nav';
import { getBlogPosts } from '@/lib/document';
import type { DocPreview } from '@/types/document';

const ScrollToTop = dynamic(() =>
  import('@/components/app/scroll-to-top').then((mod) => mod.ScrollToTop)
);
const CommandMenuDialog = dynamic(() =>
  import('@/components/app/command-menu').then((mod) => mod.CommandMenuDialog)
);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const blogs = getBlogPosts();

  const blogPreviews: DocPreview[] = blogs.map((blog) => ({
    slug: blog.slug,
    title: blog.metadata.title,
    category: blog.metadata.category,
  }));

  return (
    <NavigationPrefetchProvider>
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
    </NavigationPrefetchProvider>
  );
}
