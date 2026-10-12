import { format } from 'date-fns';

import {
  parseResumeEntries,
  type ResumeEntryMetadata,
} from '@/lib/parse-resume-entries';
import type { ResumeDoc } from '@/types/document';

function formatEntryHeading(entry: ResumeEntryMetadata) {
  const title = entry.href ? `[${entry.title}](${entry.href})` : entry.title;
  const details = [entry.subtitle, entry.location].filter(Boolean);
  const heading = [title, ...details].join(' | ');

  return `### ${heading}${entry.date ? ` (${entry.date})` : ''}`;
}

export function formatResumeMarkdown(doc: ResumeDoc) {
  const { name, location, links, description, updatedAt } = doc.metadata;
  const contact = [
    location,
    `[${links.website.replace(/^https?:\/\//, '')}](${links.website})`,
    `[GitHub](${links.github})`,
    `[LinkedIn](${links.linkedin})`,
  ].join(' | ');
  const { content } = parseResumeEntries(doc.content, formatEntryHeading);

  return `# ${name}\n\n${contact}\n\n${description}\n\n${content.trim()}\n\nLast updated on ${format(new Date(updatedAt), 'MMMM d, yyyy')}`;
}
