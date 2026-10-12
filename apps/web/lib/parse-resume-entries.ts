export type ResumeEntryMetadata = {
  title: string;
  subtitle?: string;
  date?: string;
  href?: string;
  location?: string;
};

const ENTRY_ATTRIBUTES = new Set<keyof ResumeEntryMetadata>([
  'title',
  'subtitle',
  'date',
  'href',
  'location',
]);

/** Replaces metadata blocks without reserializing the authored Markdown. */
export function parseResumeEntries(
  source: string,
  formatHeading: (entry: ResumeEntryMetadata) => string = (entry) =>
    `### ${entry.title}`
): {
  content: string;
  entries: ResumeEntryMetadata[];
} {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  const entries: ResumeEntryMetadata[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (lines[index] !== '--') {
      output.push(lines[index]);
      continue;
    }

    const startLine = index + 1;
    const values = new Map<keyof ResumeEntryMetadata, string>();

    while (++index < lines.length && lines[index] !== '--') {
      const attribute = lines[index].match(/^([a-z]+)="([^"]*)"$/);
      const name = attribute?.[1] as keyof ResumeEntryMetadata | undefined;

      if (!name || !ENTRY_ATTRIBUTES.has(name) || values.has(name)) {
        throw new Error(`Invalid resume entry attribute on line ${index + 1}`);
      }

      values.set(name, attribute![2]);
    }

    const title = values.get('title');

    if (index === lines.length || !title) {
      throw new Error(`Invalid resume entry starting on line ${startLine}`);
    }

    const entry: ResumeEntryMetadata = {
      title,
      subtitle: values.get('subtitle'),
      date: values.get('date'),
      href: values.get('href'),
      location: values.get('location'),
    };
    entries.push(entry);
    output.push(formatHeading(entry));
  }

  return { content: output.join('\n'), entries };
}
