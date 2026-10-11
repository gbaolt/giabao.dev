import { compileMDX } from 'next-mdx-remote/rsc';
import type { ReactNode } from 'react';
import remarkGfm from 'remark-gfm';

import { PdfcnThemeProvider } from '@/components/pdf/theme-provider';
import { RESUME_FONT_FAMILY } from '@/config/resume';
import { parseResumeEntries } from '@/lib/parse-resume-entries';
import { pointToCssPixel } from '@/lib/pdfcn/pdf-primitives';
import { remarkResumeEntry } from '@/lib/remark-resume-entry';
import type { ResumeDoc } from '@/types/document';

import { resumePdfComponents } from '../components/pdf/mdx-components';
import {
  ResumeDocument,
  ResumeHeaderBlock,
  ResumeSection,
  ResumeSectionLead,
  splitResumeSections,
} from '../components/pdf/resume-document';
import { planResumePagination } from './paginate-resume';
import { resumeFonts } from './pdf-fonts';
import { resumeTheme } from './pdf-theme';
import { measure, render } from './takumi';

const { page } = resumeTheme.spacing;

const PAGE_MARGIN = {
  top: pointToCssPixel(page.marginTop),
  right: pointToCssPixel(page.marginRight),
  bottom: pointToCssPixel(page.marginBottom),
  left: pointToCssPixel(page.marginLeft),
};

const A4_WIDTH_PX = (210 / 25.4) * 96;
const A4_HEIGHT_PX = (297 / 25.4) * 96;
const PAGE_CONTENT_HEIGHT_PX =
  A4_HEIGHT_PX - PAGE_MARGIN.top - PAGE_MARGIN.bottom;
const PAGE_CONTENT_WIDTH_PX =
  A4_WIDTH_PX - PAGE_MARGIN.left - PAGE_MARGIN.right;
const MIN_LINE_HEIGHT = 1.12;
const OVERFLOW_LINE_COUNT = 8;

const RENDER_OPTIONS = {
  size: 'a4' as const,
  margin: PAGE_MARGIN,
  fonts: resumeFonts,
  fontFamilies: [RESUME_FONT_FAMILY, 'serif'],
  lang: 'en',
};

const MEASURE_OPTIONS = {
  viewport: { width: PAGE_CONTENT_WIDTH_PX },
  fonts: RENDER_OPTIONS.fonts,
  fontFamilies: RENDER_OPTIONS.fontFamilies,
  lang: RENDER_OPTIONS.lang,
};

function themed(node: ReactNode) {
  return <PdfcnThemeProvider theme={resumeTheme}>{node}</PdfcnThemeProvider>;
}

/**
 * Compiles the Resume source with the PDF component map and renders it to
 * A4 bytes with Takumi. Runs from the Bun build script, not a Vercel function.
 */
export async function renderResumePdf(doc: ResumeDoc): Promise<Uint8Array> {
  'use cache';

  const { content: source, entries } = parseResumeEntries(doc.content);
  const { content } = await compileMDX({
    source,
    components: resumePdfComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkResumeEntry(entries)],
      },
    },
  });

  const sections = splitResumeSections(content);
  const { height: headerHeight } = await measure(
    themed(<ResumeHeaderBlock metadata={doc.metadata} />),
    MEASURE_OPTIONS
  );

  const sectionHeights: number[] = [];
  const leadHeights: number[] = [];

  // Measure one tree at a time. PdfcnThemeProvider writes a module-level theme.
  for (const nodes of sections) {
    const { height: sectionHeight } = await measure(
      themed(<ResumeSection nodes={nodes} />),
      MEASURE_OPTIONS
    );
    const { height: leadHeight } = await measure(
      themed(<ResumeSectionLead nodes={nodes} />),
      MEASURE_OPTIONS
    );

    sectionHeights.push(sectionHeight);
    leadHeights.push(leadHeight);
  }

  const defaultLineHeight = resumeTheme.typography.body.lineHeight;
  const plans = planResumePagination({
    headerHeight,
    sectionHeights,
    leadHeights,
    pageContentHeight: PAGE_CONTENT_HEIGHT_PX,
    defaultLineHeight,
    minLineHeight: MIN_LINE_HEIGHT,
    overflowLineCount: OVERFLOW_LINE_COUNT,
    linePx:
      pointToCssPixel(resumeTheme.typography.body.fontSize) * defaultLineHeight,
  });

  return render(
    themed(
      <ResumeDocument metadata={doc.metadata} plans={plans}>
        {content}
      </ResumeDocument>
    ),
    {
      ...RENDER_OPTIONS,
      outline: true,
      metadata: {
        title: `${doc.metadata.name} - ${doc.metadata.title}`,
        authors: [doc.metadata.name],
      },
    }
  );
}
