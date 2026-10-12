import { format } from 'date-fns';
import { FileTextIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { WebPage, WithContext } from 'schema-dts';

import { simpleOgImageUrl } from '@/app/og/params';
import { MDCopyButtonGroup } from '@/components/app/page-actions';
import { ShareMenu } from '@/components/app/share-menu';
import { jsonLdBreadcrumbList, JsonLdScript } from '@/components/json-ld';
import { AppShell } from '@/components/layout/app-shell';
import { JSON_LD_ID } from '@/config/json-ld';
import { RESUME_MD_PATH, RESUME_PATH, RESUME_PDF_PATH } from '@/config/resume';
import { X_PROFILE } from '@/config/site';
import {
  DocContainer,
  DocContentCol,
  DocGrid,
  DocLeftCol,
  DocRightCol,
} from '@/features/blog/components/doc/doc-layout';
import { DocPageRoot } from '@/features/blog/components/doc/doc-page-root';
import { DownloadResumeButton } from '@/features/resume/components/download-resume-button';
import {
  ResumeViewer,
  ResumeViewerToolbar,
} from '@/features/resume/components/viewer/resume-viewer';
import { ResumeViewerPreview } from '@/features/resume/components/viewer/resume-viewer-preview';
import { getResumeDoc } from '@/lib/document';
import { absoluteUrl } from '@/lib/utils';

const title = 'Resume';
const description = 'View and download my professional resume';
const ogImage = simpleOgImageUrl(title, description);

function getResumeJsonLd(): WithContext<WebPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': absoluteUrl(RESUME_PATH),
    name: title,
    description,
    url: absoluteUrl(RESUME_PATH),
    isPartOf: { '@id': JSON_LD_ID.website },
    about: { '@id': JSON_LD_ID.person },
    mainEntity: {
      '@type': 'DigitalDocument',
      '@id': absoluteUrl(RESUME_PDF_PATH),
      name: title,
      url: absoluteUrl(RESUME_PDF_PATH),
      encodingFormat: 'application/pdf',
      author: { '@id': JSON_LD_ID.person },
    },
  };
}

export function generateMetadata(): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: RESUME_PATH,
    },
    openGraph: {
      url: RESUME_PATH,
      type: 'profile',
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

export default function ResumePage() {
  const resume = getResumeDoc();
  const updatedAt = resume ? new Date(resume.metadata.updatedAt) : null;

  return (
    <>
      <JsonLdScript data={getResumeJsonLd()} />
      <JsonLdScript
        data={jsonLdBreadcrumbList([
          { name: 'Home', href: '/' },
          { name: 'Resume', href: '/resume' },
        ])}
      />

      <AppShell
        title={title}
        description={description}
        className="md:max-w-4xl"
      >
        <DocPageRoot className="flex h-full flex-1 flex-col border-x">
          <ResumeViewer src={RESUME_PDF_PATH}>
            <DocContainer>
              <div className="flex items-center justify-between gap-2 p-2">
                <ResumeViewerToolbar className="md:hidden" />

                <div
                  data-slot="resume-update-timestamp"
                  className="hidden items-center gap-2 text-sm whitespace-nowrap md:flex"
                >
                  <FileTextIcon
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                  {updatedAt && (
                    <span className="text-muted-foreground">
                      Updated{' '}
                      <time dateTime={updatedAt.toISOString()}>
                        {format(updatedAt, 'MMM d, yyyy')}
                      </time>
                    </span>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <MDCopyButtonGroup markdownUrl={RESUME_MD_PATH} />
                  <ShareMenu title={title} url={RESUME_PATH} />
                  <DownloadResumeButton className="md:hidden" />
                </div>
              </div>
            </DocContainer>

            <DocGrid className="flex-1 grid-rows-1 overflow-x-hidden">
              <DocLeftCol />

              <DocContentCol className="border-t">
                <div className="py-4">
                  <ResumeViewerPreview className="border-y" />
                </div>
              </DocContentCol>

              <DocRightCol />
            </DocGrid>
          </ResumeViewer>
        </DocPageRoot>
      </AppShell>
    </>
  );
}
