import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';
import matter from 'gray-matter';

import type { ResumeDoc } from '@/types/document';

import { formatResumeMarkdown } from '../resume-markdown';

const source = matter(
  readFileSync(
    path.join(import.meta.dir, '../../docs/resume/resume.mdx'),
    'utf8'
  )
);
const doc: ResumeDoc = {
  slug: 'resume',
  content: source.content,
  metadata: source.data as ResumeDoc['metadata'],
};

test('keeps every authored resume paragraph and bullet unchanged', () => {
  const markdown = formatResumeMarkdown(doc);
  const bodyLines = doc.content
    .split(/\r?\n/)
    .filter((line) => /^(?:- |\*\*|## )/.test(line));

  for (const line of bodyLines) {
    expect(markdown).toContain(line);
  }

  expect(markdown).toStartWith(`# ${doc.metadata.name}\n`);
  expect(markdown).not.toContain('\n--\n');
  expect(markdown).toContain(doc.metadata.links.github);
  expect(markdown).toContain(doc.metadata.links.linkedin);
});

test('expands entry details while preserving authored Markdown syntax', () => {
  const body =
    '- Built a Q&A tool for TKU@Unicorn&Wheat.\n- Read [_the paper_](https://example.com/paper).';
  const markdown = formatResumeMarkdown({
    ...doc,
    content: `## Projects\n\n--\ntitle="Example"\nsubtitle="React & TypeScript"\ndate="2026"\nlocation="Vietnam"\nhref="https://example.com"\n--\n\n${body}`,
  });

  expect(markdown).toContain(
    '### [Example](https://example.com) | React & TypeScript | Vietnam (2026)'
  );
  expect(markdown).toContain(body);
  expect(markdown).not.toContain('Q\\&A');
});
