'use client';

import type { DocSummary } from '@/types/document';

import { useSearchQuery } from './use-search-query';
import { useTagFilter } from './use-tag-filter';

const normalize = (text: string) => text.toLowerCase().replaceAll(' ', '');

const matchesQuery = (post: DocSummary, normalizedQuery: string) => {
  const normalizedTitle = normalize(post.metadata.title);
  const normalizedDescription = normalize(post.metadata.description);

  return (
    normalizedTitle.includes(normalizedQuery) ||
    normalizedDescription.includes(normalizedQuery)
  );
};

const searchBlogs = (posts: DocSummary[], query: string | null) => {
  if (!query) return posts;

  const normalizedQuery = normalize(query);
  return posts.filter((post) => matchesQuery(post, normalizedQuery));
};

export function useFilteredBlogs(posts: DocSummary[]) {
  const { query } = useSearchQuery();
  const { tags } = useTagFilter();
  const searchResults = searchBlogs(posts, query);

  if (tags.length === 0) return searchResults;

  const selectedTags = new Set(tags);
  return searchResults.filter((post) =>
    post.metadata.tags?.some((tag) => selectedTags.has(tag))
  );
}
