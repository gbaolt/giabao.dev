import { cacheLife } from 'next/cache';

import type { Activity } from '@/components/kibo-ui/contribution-graph';
import { GITHUB_PROFILE } from '@/config/site';

type GitHubContributionsResponse = {
  contributions: Activity[];
};

const FETCH_TIMEOUT = 5000;

const isActivity = (value: unknown): value is Activity => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.date === 'string' &&
    typeof record.count === 'number' &&
    typeof record.level === 'number'
  );
};

const normalizeContributions = (value: unknown): Activity[] | null => {
  if (Array.isArray(value)) {
    return value.filter(isActivity);
  }

  if (typeof value === 'object' && value !== null) {
    const { contributions } = value as Record<string, unknown>;
    if (Array.isArray(contributions)) {
      return contributions.filter(isActivity);
    }
  }

  return null;
};

const fetchGitHubContributions = async (): Promise<Activity[]> => {
  'use cache';

  cacheLife({
    stale: 3600,
    revalidate: 24 * 3600,
    expire: 7 * 24 * 3600,
  });

  const api = process.env.GITHUB_CONTRIBUTIONS_API;
  if (!api) {
    throw new Error('GITHUB_CONTRIBUTIONS_API is missing');
  }

  const res = await fetch(`${api}/v4/${GITHUB_PROFILE}?y=last`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`GitHub contributions API responded with ${res.status}`);
  }

  const data = (await res.json()) as GitHubContributionsResponse | Activity[];
  const contributions = normalizeContributions(data);

  if (contributions === null) {
    throw new Error('GitHub contributions API returned an unexpected payload');
  }

  return contributions;
};

export const getGitHubContributions = async (): Promise<Activity[] | null> => {
  try {
    return await fetchGitHubContributions();
  } catch (error) {
    console.warn('Failed to load GitHub contributions:', error);
    return null;
  }
};
