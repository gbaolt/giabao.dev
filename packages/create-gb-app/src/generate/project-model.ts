import type { FileMap, PackageManager } from '../types/generate';
import type { Stack } from '../types/stack';
import { sortRecord } from './files';
import { joinPath, type ProjectLayout } from './layout';
import { finalizeWorkspaces } from './workspaces';

/** A workspace `package.json`; key order is the rendered order. */
export type Manifest = {
  name: string;
  version?: string;
  private?: boolean;
  type?: 'module';
  files?: string[];
  exports?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?:
    string[] | { packages: string[]; catalog: Record<string, string> };
  engines?: { node: string };
  packageManager?: string;
};

/** README sections an emit module may contribute; the README places them. */
export type ReadmeSectionId = 'configuration-notes' | 'hosted-database';

/** What emit modules contribute; `renderProject` turns it into files. */
export type ProjectModel = {
  /** Root `.gitignore` lines; order matters for negations like `!.env.example`. */
  ignoreLines: string[];
  readmeSections: Partial<Record<ReadmeSectionId, string>>;
  /** Env keys to development values, in contribution order. */
  env: Record<string, string>;
  /** Workspace manifests by path; registration order is workspace order. */
  manifests: Record<string, Manifest>;
};

export function createProjectModel(): ProjectModel {
  return { ignoreLines: [], readmeSections: {}, env: {}, manifests: {} };
}

export function manifestAt(project: ProjectModel, path: string): Manifest {
  const manifest = project.manifests[path];
  if (!manifest) throw new Error(`no workspace manifest at ${path}`);
  return manifest;
}

type ManifestSections = Required<
  Pick<Manifest, 'scripts' | 'dependencies' | 'devDependencies'>
>;

/** A manifest whose scripts and dependency records exist, to write into. */
export function manifestSections(
  project: ProjectModel,
  path: string
): ManifestSections {
  const manifest = manifestAt(project, path);
  manifest.scripts ??= {};
  manifest.dependencies ??= {};
  manifest.devDependencies ??= {};
  return manifest as ManifestSections;
}

export function addDependencies(
  project: ProjectModel,
  path: string,
  dependencies: Record<string, string>
): void {
  const manifest = manifestAt(project, path);
  Object.assign((manifest.dependencies ??= {}), dependencies);
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

export type RenderTarget = {
  stack: Stack;
  layout: ProjectLayout;
  packageManager: PackageManager;
};

export function renderProject(
  project: ProjectModel,
  { stack, layout, packageManager }: RenderTarget
): FileMap {
  const files: FileMap = {};
  if (project.ignoreLines.length > 0)
    files['.gitignore'] = [...new Set(project.ignoreLines)].join('\n') + '\n';
  renderEnv(project.env, stack, layout, files);
  renderManifests(project.manifests, packageManager, files);
  return files;
}

function renderManifests(
  source: ProjectModel['manifests'],
  packageManager: PackageManager,
  files: FileMap
): void {
  const manifests = structuredClone(source);
  for (const manifest of Object.values(manifests))
    for (const section of ['scripts', 'dependencies', 'devDependencies'] as const)
      if (manifest[section]) manifest[section] = sortRecord(manifest[section]);
  Object.assign(files, finalizeWorkspaces(manifests, packageManager));
  // Workspace manifests have always shipped without a final newline.
  const ending = manifests['package.json']?.workspaces ? '' : '\n';
  for (const [path, manifest] of Object.entries(manifests))
    files[path] = JSON.stringify(manifest, null, 2) + ending;
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
