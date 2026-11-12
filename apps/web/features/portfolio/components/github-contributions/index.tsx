import { Suspense } from 'react';

import { PanelContent } from '@/components/app/panel';
import { getGitHubContributions } from '@/features/portfolio/data/github-contributions';

import { GitHubContributionFallback, GitHubContributionGraph } from './graph';

export function GitHubContributions() {
  return (
    <Suspense
      fallback={
        <ContributionsGraphPanel>
          <GitHubContributionFallback />
        </ContributionsGraphPanel>
      }
    >
      <ContributionsGraph />
    </Suspense>
  );
}

function ContributionsGraphPanel({ children }: { children: React.ReactNode }) {
  return (
    <PanelContent className="screen-line-top decor-t relative mx-auto p-2">
      <h2 className="sr-only">GitHub Contributions</h2>
      {children}
    </PanelContent>
  );
}

async function ContributionsGraph() {
  const contributions = await getGitHubContributions();

  if (!contributions) return null;

  return (
    <ContributionsGraphPanel>
      <GitHubContributionGraph contributions={contributions} />
    </ContributionsGraphPanel>
  );
}
