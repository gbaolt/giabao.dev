import type { FileMap } from '../types/generate';
import type { Stack } from '../types/stack';
import { joinPath, type ProjectLayout } from './layout';

/** README sections an emit module may contribute; the README places them. */
export type ReadmeSectionId = 'configuration-notes' | 'hosted-database';

/** What emit modules contribute; `renderProject` turns it into files. */
export type ProjectModel = {
  /** Root `.gitignore` lines; order matters for negations like `!.env.example`. */
  ignoreLines: string[];
  readmeSections: Partial<Record<ReadmeSectionId, string>>;
  /** Env keys to development values, in contribution order. */
  env: Record<string, string>;
};

export function createProjectModel(): ProjectModel {
  return { ignoreLines: [], readmeSections: {}, env: {} };
}

export function addReadmeSection(
  project: ProjectModel,
  id: ReadmeSectionId,
  body: string
): void {
  if (project.readmeSections[id] !== undefined)
    throw new Error(`README section ${id} already has a writer`);
  project.readmeSections[id] = body;
}

export function addEnv(
  project: ProjectModel,
  entries: Record<string, string>
): void {
  for (const [key, value] of Object.entries(entries)) {
    if (key in project.env)
      throw new Error(`env entry ${key} already has a writer`);
    project.env[key] = value;
  }
}

export type RenderTarget = { stack: Stack; layout: ProjectLayout };

export function renderProject(
  project: ProjectModel,
  { stack, layout }: RenderTarget
): FileMap {
  const files: FileMap = {};
  if (project.ignoreLines.length > 0)
    files['.gitignore'] = [...new Set(project.ignoreLines)].join('\n') + '\n';
  renderEnv(project.env, stack, layout, files);
  return files;
}

function renderEnv(
  env: ProjectModel['env'],
  stack: Stack,
  layout: ProjectLayout,
  files: FileMap
): void {
  const lines = Object.entries(env).map(([key, value]) => `${key}="${value}"`);
  if (lines.length === 0) return;
  // Server backends without a database keep env at the root (#251 story 2).
  const owner =
    layout.envOwner === 'apps/server' &&
    'database' in stack &&
    stack.database === 'none'
      ? ''
      : layout.envOwner;
  const publicLines =
    owner === 'apps/server'
      ? lines.filter((line) => /^(NEXT_PUBLIC_|VITE_)/.test(line))
      : [];
  for (const name of ['.env', '.env.example']) {
    files[joinPath(owner, name)] = lines.join('\n') + '\n';
    if (publicLines.length > 0)
      files[joinPath(layout.frontendRoot, name)] = publicLines.join('\n') + '\n';
  }
}
