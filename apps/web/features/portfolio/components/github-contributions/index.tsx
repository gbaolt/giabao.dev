import { Suspense } from 'react';

import { PanelContent } from '@/components/app/panel';
import { getGitHubContributions } from '@/features/portfolio/data/github-contributions';

import { GitHubContributionFallback, GitHubContributionGraph } from './graph';

export function GitHubContributions() {
  return (
    <PanelContent className="screen-line-top decor-t relative mx-auto p-2">
      <h2 className="sr-only">GitHub Contributions</h2>
      <Suspense fallback={<GitHubContributionFallback />}>
        <ContributionsGraph />
      </Suspense>
    </PanelContent>
  );
}

async function ContributionsGraph() {
  const contributions = await getGitHubContributions();

  if (contributions.length === 0) return null;

  return <GitHubContributionGraph contributions={contributions} />;
}
