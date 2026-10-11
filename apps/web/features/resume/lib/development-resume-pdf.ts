import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const INPUT_DIRECTORIES = [
  'docs/resume',
  'features/resume/lib',
  'features/resume/hooks',
  'features/resume/components/pdf',
  'components/pdf',
  'lib/pdfcn',
  'assets/fonts/cmu-serif',
];

const INPUT_FILES = [
  'config/resume.ts',
  'lib/document.ts',
  'lib/reading-time.ts',
  'lib/parse-resume-entries.ts',
  'lib/remark-resume-entry.ts',
  'scripts/render-resume-pdf.ts',
  'package.json',
  '../../bun.lock',
];

export function createResumePdfCache(renderPdf: () => Promise<Uint8Array>) {
  let cached: { version: string; pdf: Promise<Uint8Array> } | undefined;

  return (version: string): Promise<Uint8Array> => {
    if (cached?.version === version) return cached.pdf;

    const entry = {
      version,
      pdf: Promise.resolve().then(renderPdf),
    };
    cached = entry;

    entry.pdf = entry.pdf.catch((error: unknown) => {
      if (cached === entry) cached = undefined;
      throw error;
    });

    return entry.pdf;
  };
}

async function getInputVersion() {
  const directories = await Promise.all(
    INPUT_DIRECTORIES.map(async (directory) => {
      const entries = await readdir(path.join(process.cwd(), directory), {
        recursive: true,
        withFileTypes: true,
      });

      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name));
    })
  );
  const files = [
    ...INPUT_FILES.map((file) => path.join(process.cwd(), file)),
    ...directories.flat(),
  ].sort();
  const contents = await Promise.all(files.map((file) => readFile(file)));
  const version = createHash('sha256');

  for (const [index, file] of files.entries()) {
    version.update(file).update('\0').update(contents[index]).update('\0');
  }

  return version.digest('hex');
}

// Hash the inputs so MDX, layout, and font edits invalidate the shared render.
const getCachedPdf = createResumePdfCache(async () => {
  const { stdout } = await promisify(execFile)(
    'bun',
    ['run', '--bun', './scripts/render-resume-pdf.ts', '--stdout'],
    { encoding: 'buffer' }
  );

  return new Uint8Array(stdout);
});

export async function getDevelopmentResumePdf() {
  return getCachedPdf(await getInputVersion());
}
