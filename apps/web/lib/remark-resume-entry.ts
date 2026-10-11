import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

import type { ResumeEntryMetadata } from '@/lib/parse-resume-entries';

export function remarkResumeEntry(entries: ResumeEntryMetadata[]) {
  return () => (tree: Root) => {
    let index = 0;

    visit(tree, 'heading', (heading) => {
      if (heading.depth !== 3) return;

      const entry = entries[index++];

      if (!entry) throw new Error('Resume heading has no metadata block');

      heading.data = {
        ...heading.data,
        hProperties: {
          'data-resume-title': entry.title,
          'data-resume-subtitle': entry.subtitle,
          'data-resume-date': entry.date,
          'data-resume-href': entry.href,
          'data-resume-location': entry.location,
        },
      };
    });

    if (index !== entries.length) {
      throw new Error('Resume metadata block has no heading');
    }
  };
}
