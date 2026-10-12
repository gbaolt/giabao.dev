import type { Doc } from '@/types/document';

export function getNextPosts({
  post,
  posts,
}: {
  post: Doc;
  posts: readonly Doc[];
}): Doc[] {
  const tags = new Set(post.metadata.tags?.map((tag) => tag.toLowerCase()));

  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const candidateTags = new Set(
        candidate.metadata.tags?.map((tag) => tag.toLowerCase())
      );
      const sharedTags = Array.from(candidateTags).filter((tag) =>
        tags.has(tag)
      ).length;

      return { post: candidate, sharedTags };
    })
    .sort(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        new Date(b.post.metadata.createdAt).getTime() -
          new Date(a.post.metadata.createdAt).getTime() ||
        a.post.slug.localeCompare(b.post.slug)
    )
    .slice(0, 3)
    .map(({ post }) => post);
}
