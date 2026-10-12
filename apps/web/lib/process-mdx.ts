import { format } from 'date-fns';
import { remarkHeading } from 'fumadocs-core/mdx-plugins/remark-heading';
import { cacheLife } from 'next/cache';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';

import { RESUME_CATEGORY } from '@/lib/document';
import { formatResumeMarkdown } from '@/lib/resume-markdown';
import type { Doc, ResumeDoc } from '@/types/document';

const processor = remark().use(remarkMdx).use(remarkGfm).use(remarkHeading);

function isResumeDoc(doc: Doc): doc is ResumeDoc {
  return doc.metadata.category === RESUME_CATEGORY;
}

export async function processMdxForLLMs(doc: Doc) {
  'use cache';
  cacheLife('max');

  if (isResumeDoc(doc)) return formatResumeMarkdown(doc);

  const processed = await processor.process({ value: doc.content });

  return `# ${doc.metadata.title}

${doc.metadata.description}

${processed.value}

Last updated on ${format(new Date(doc.metadata.updatedAt), 'MMMM d, yyyy')}`;
}
