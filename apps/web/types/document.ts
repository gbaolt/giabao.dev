export type DocMetadata = {
  title: string;
  description: string;
  /**
   * Social/OG image URL for the post.
   * Use an absolute URL or a path under /public. Recommended size: 1200x630.
   */
  image?: string;
  /** Author of the post. */
  author?: string;
  /** Author avatar of the post. */
  avatar?: string;
  /**
   * Category identifier, derived from the doc's content subfolder
   * (e.g. `content/blog/*` → "blog"). Not declared in frontmatter;
   * injected when docs are read. Used for filtering (see getDocsByCategory).
   */
  category?: string;
  /** Tags for the document. Used for filtering. */
  tags?: string[];
  /**
   * Estimated reading time in minutes.
   * Optional in frontmatter as an override; otherwise computed from the MDX
   * body (prose WPM + slower fenced-code pacing + Medium-style images).
   */
  duration?: number;
  /** Flag to show a "New" badge/highlight in the UI. */
  new?: boolean;
  updated?: boolean;
  /** Flag to pin the post to the top of the list. */
  pinned?: boolean;
  /** Post creation date as an ISO date string (e.g. YYYY-MM-DD). Used for sorting. */
  createdAt: string;
  /** Last updated date as an ISO date string (e.g. YYYY-MM-DD). */
  updatedAt: string;
};

export type Doc = {
  /** Parsed frontmatter metadata from the MDX file. */
  metadata: DocMetadata;
  /** Slug derived from the MDX filename (without extension). */
  slug: string;
  /** MDX content body without frontmatter. */
  content: string;
};

export type DocSummary = Pick<Doc, 'slug' | 'metadata'>;

/** Contact links shown in the Resume header. */
export type ResumeLinks = {
  website: string;
  github: string;
  linkedin: string;
};

/** Frontmatter of the Resume source: base doc fields plus the header block. */
export type ResumeMetadata = DocMetadata & {
  name: string;
  location: string;
  links: ResumeLinks;
};

export type ResumeDoc = Doc & {
  metadata: ResumeMetadata;
};

/**
 * Minimal blog data for client components that don't need the full content.
 * Reduces serialization overhead and bundle size.
 */
export type DocPreview = {
  slug: string;
  title: string;
  category?: string;
};
