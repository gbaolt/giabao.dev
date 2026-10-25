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
  authPlugins: AuthPlugin[];
  authConfig: AuthConfig | null;
  /** The providers file; a pass-through renders when no module writes one. */
  providers: string | null;
  /** The Next root layout or Start root route, rendered with its wrappers. */
  rootDocument: ((wrappers: DocumentWrapper[]) => string) | null;
  documentWrappers: DocumentWrapper[];
};

/** A component that wraps the root document's body, outermost first. */
export type DocumentWrapper = {
  /** Import and setup lines placed above the document. */
  imports: string;
  component: string;
  htmlAttributes: string[];
};

const PASS_THROUGH_PROVIDERS = `import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return children;
}
`;

export function setProviders(project: ProjectModel, source: string): void {
  if (project.providers !== null)
    throw new Error('providers file already has a writer');
  project.providers = source;
}

export function setRootDocument(
  project: ProjectModel,
  render: NonNullable<ProjectModel['rootDocument']>
): void {
  if (project.rootDocument) throw new Error('root document already has a writer');
  project.rootDocument = render;
}

/** A Better Auth plugin: `import { name } from "from"` and its call. */
export type AuthPlugin = { name: string; from: string; call: string };

/** The auth config file, rendered once every plugin is known. */
export type AuthConfig = {
  path: string;
  render: (plugins: AuthPlugin[]) => string;
};

export function createProjectModel(): ProjectModel {
  return {
    ignoreLines: [],
    readmeSections: {},
    env: {},
    manifests: {},
    authPlugins: [],
    authConfig: null,
    providers: null,
    rootDocument: null,
    documentWrappers: [],
  };
}

/** Collections that belong to one app build, not the whole project. */
export function appCollections(): Pick<
  ProjectModel,
  'readmeSections' | 'manifests' | 'authPlugins' | 'authConfig'
> {
  return { readmeSections: {}, manifests: {}, authPlugins: [], authConfig: null };
}

export function setAuthConfig(project: ProjectModel, config: AuthConfig): void {
  if (project.authConfig)
    throw new Error(`auth config ${project.authConfig.path} already has a writer`);
  project.authConfig = config;
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
  layout: ProjectLayout;
  packageManager: PackageManager;
};

export function renderProject(
  project: ProjectModel,
  { layout, packageManager }: RenderTarget
): FileMap {
  const files: FileMap = renderAppFiles(project);
  files[layout.providersFile] = withNewline(
    project.providers ?? PASS_THROUGH_PROVIDERS
  );
  if (project.rootDocument)
    files[layout.rootLayout] = withNewline(
      project.rootDocument(project.documentWrappers)
    );
  if (project.ignoreLines.length > 0)
    files['.gitignore'] = [...new Set(project.ignoreLines)].join('\n') + '\n';
  renderEnv(project.env, layout, files);
  renderManifests(project.manifests, packageManager, files);
  return files;
}

/** Files one app build renders itself, before a monorepo relocates them. */
export function renderAppFiles(project: ProjectModel): FileMap {
  const files: FileMap = {};
  const { authConfig } = project;
  if (authConfig)
    files[authConfig.path] = withNewline(authConfig.render(project.authPlugins));
  return files;
}

function withNewline(source: string): string {
  return source.endsWith('\n') ? source : `${source}\n`;
}

/** NodeNext server workspaces need explicit `.js` relative specifiers. */
export function applyServerModuleFormat(
  files: FileMap,
  stack: Stack,
  layout: ProjectLayout
): void {
  // Server backends without a database keep bare specifiers (#251 story 2).
  if (stack.backend !== 'nest' && stack.backend !== 'hono') return;
  if (stack.database === 'none') return;
  for (const [path, source] of Object.entries(files)) {
    if (!path.startsWith(`${layout.serverSourceRoot}/`) || !path.endsWith('.ts'))
      continue;
    files[path] = source.replace(
      /from (["'])(\.[^"']+)\1/g,
      (match, quote: string, specifier: string) =>
        /\.[a-z]+$/.test(specifier) ? match : `from ${quote}${specifier}.js${quote}`
    );
  }
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
  layout: ProjectLayout,
  files: FileMap
): void {
  const lines = Object.entries(env).map(([key, value]) => `${key}="${value}"`);
  if (lines.length === 0) return;
  const owner = layout.envOwner;
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
