import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { cache } from 'react';

import { estimateReadingTime } from '@/lib/reading-time';
import type {
  Doc,
  DocMetadata,
  ResumeDoc,
  ResumeLinks,
} from '@/types/document';

function parseFrontmatter(fileContent: string) {
  const file = matter(fileContent);

  return {
    metadata: file.data as DocMetadata,
    content: file.content,
  };
}

/** Prefer frontmatter `duration`; otherwise estimate from the MDX body. */
function resolveDuration(metadata: DocMetadata, content: string) {
  if (typeof metadata.duration === 'number' && metadata.duration > 0) {
    return Math.ceil(metadata.duration);
  }

  return estimateReadingTime(content).minutes;
}

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === '.mdx');
}

function readMDXFile(filePath: string) {
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const doc = parseFrontmatter(rawContent);
  const createdAt: unknown = doc.metadata.createdAt;
  const timestamp =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === 'string'
        ? Date.parse(createdAt)
        : NaN;

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `${filePath} has an invalid createdAt; expected a valid date string in frontmatter`
    );
  }

  return doc;
}

/**
 * Reads MDX docs from `dir`, grouping them by their immediate subfolder.
 * The subfolder name is the doc's category (e.g. `docs/blogs/*.mdx`
 * yields docs with `category: "blogs"`), so category is derived from the
 * file location rather than declared in frontmatter.
 */
function getMDXData(dir: string) {
  const categoryDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  return categoryDirs.flatMap((categoryDir) => {
    const category = categoryDir.name;
    const categoryPath = path.join(dir, category);

    return getMDXFiles(categoryPath).map<Doc>((file) => {
      const { metadata, content } = readMDXFile(path.join(categoryPath, file));

      const slug = path.basename(file, path.extname(file));

      return {
        metadata: {
          ...metadata,
          category,
          duration: resolveDuration(metadata, content),
        },
        slug,
        content,
      };
    });
  });
}

export const getAllDocs = cache(() => {
  return getMDXData(path.join(process.cwd(), 'docs')).sort((a, b) => {
    if (a.metadata.pinned && !b.metadata.pinned) return -1;
    if (!a.metadata.pinned && b.metadata.pinned) return 1;

    return (
      new Date(b.metadata.createdAt).getTime() -
      new Date(a.metadata.createdAt).getTime()
    );
  });
});

export function getDocsByCategory(category: string) {
  return getAllDocs().filter((doc) => doc.metadata?.category === category);
}

export function getDocBySlug(slug: string, category: string) {
  return getDocsByCategory(category).find((doc) => doc.slug === slug);
}

export const BLOG_CATEGORY = 'blog';
export const RESUME_CATEGORY = 'resume';

export function getBlogPosts() {
  return getDocsByCategory(BLOG_CATEGORY);
}

const RESUME_LINK_KEYS = ['website', 'github', 'linkedin'] as const;

function isResumeDoc(doc: Doc): doc is ResumeDoc {
  const { name, location, links } = doc.metadata as Partial<
    ResumeDoc['metadata']
  >;

  if (typeof name !== 'string' || typeof location !== 'string') return false;
  if (!links || typeof links !== 'object') return false;

  return RESUME_LINK_KEYS.every(
    (key) => typeof (links as Partial<ResumeLinks>)[key] === 'string'
  );
}

/**
 * The single Resume source. Returns undefined when no doc exists and throws
 * when the frontmatter lacks the header fields the PDF and Markdown mirror
 * depend on, so authoring mistakes fail the build instead of rendering blanks.
 */
export function getResumeDoc(): ResumeDoc | undefined {
  const doc = getDocsByCategory(RESUME_CATEGORY)[0];

  if (!doc) return undefined;

  if (!isResumeDoc(doc)) {
    throw new Error(
      `docs/${RESUME_CATEGORY}/${doc.slug}.mdx is missing header frontmatter (name, location, links.website, links.github, links.linkedin)`
    );
  }

  return doc;
}

export function findNeighbour(docs: Doc[], slug: string) {
  const len = docs.length;

  for (let i = 0; i < len; ++i) {
    if (docs[i].slug === slug) {
      return {
        previous: i > 0 ? docs[i - 1] : null,
        next: i < len - 1 ? docs[i + 1] : null,
      };
    }
  }

  return { previous: null, next: null };
}
