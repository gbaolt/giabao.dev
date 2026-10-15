import type { FileMap, PackageManager } from '#/types/generate';

import { DEPENDENCY_VERSIONS } from './dependency-versions';
import { PACKAGE_MANAGER_METADATA } from './package-managers';

type Manifest = {
  name: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?:
    string[] | { packages: string[]; catalog: Record<string, string> };
  packageManager?: string;
};

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;
const WORKSPACE_PATTERNS = ['apps/*', 'packages/*'];

export function finalizeWorkspaces(
  files: FileMap,
  packageManager: PackageManager
): void {
  const manifests = Object.entries(files)
    .filter(
      ([path]) => path.endsWith('/package.json') || path === 'package.json'
    )
    .map(([path, contents]) => ({
      path,
      manifest: JSON.parse(contents) as Manifest,
    }));
  const root = manifests.find(({ path }) => path === 'package.json')?.manifest;
  if (!root?.workspaces) return;

  const internal = new Map(
    manifests
      .filter(({ path }) => path !== 'package.json')
      .map(({ manifest }) => [manifest.name, manifest])
  );
  const requirements = new Map<string, { version: string; owner: string }>();
  for (const { path, manifest } of manifests) {
    for (const section of DEPENDENCY_SECTIONS) {
      for (const [dependency, version] of Object.entries(
        manifest[section] ?? {}
      )) {
        if (
          dependency.startsWith('@repo/') ||
          version.startsWith('workspace:')
        ) {
          if (!internal.has(dependency))
            throw new Error(
              `Unresolved workspace dependency ${dependency} in ${path}`
            );
          continue;
        }
        if (version.startsWith('catalog:'))
          throw new Error(
            `Missing concrete catalog requirement for ${dependency} in ${path}`
          );
        if (section === 'peerDependencies') continue;
        const canonical = DEPENDENCY_VERSIONS[dependency];
        if (!canonical)
          throw new Error(
            `Missing central dependency version for ${dependency} in ${path}`
          );
        if (canonical !== version)
          throw new Error(
            `Conflicting central version for ${dependency}: ${canonical}, ${version} in ${path}`
          );
        const existing = requirements.get(dependency);
        if (existing && existing.version !== version) {
          throw new Error(
            `Conflicting versions for ${dependency}: ${existing.version} in ${existing.owner}, ${version} in ${path}`
          );
        }
        requirements.set(dependency, { version: canonical, owner: path });
      }
    }
  }
  const catalog = Object.fromEntries(
    [...requirements.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { version }]) => [name, version])
  );

  for (const { path, manifest } of manifests) {
    for (const section of DEPENDENCY_SECTIONS) {
      for (const [dependency, version] of Object.entries(
        manifest[section] ?? {}
      )) {
        if (internal.has(dependency)) {
          manifest[section]![dependency] =
            packageManager === 'npm' ? '*' : 'workspace:*';
        } else if (
          section !== 'peerDependencies' &&
          !(packageManager === 'yarn' && section === 'optionalDependencies')
        ) {
          manifest[section]![dependency] =
            packageManager === 'npm' ? version : 'catalog:';
        }
      }
    }
    if (path === 'package.json') {
      for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
        manifest.scripts![name] = script.replace(
          /^turbo (?!run\b)/,
          'turbo run '
        );
      }
      manifest.packageManager = `${packageManager}@${PACKAGE_MANAGER_METADATA[packageManager].version}`;
      manifest.workspaces =
        packageManager === 'bun'
          ? { packages: WORKSPACE_PATTERNS, catalog }
          : WORKSPACE_PATTERNS;
    }
    files[path] = JSON.stringify(manifest, null, 2);
  }

  const yamlCatalog = Object.entries(catalog)
    .map(
      ([name, version]) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`
    )
    .join('\n');
  if (packageManager === 'pnpm')
    files['pnpm-workspace.yaml'] =
      `packages:\n  - "apps/*"\n  - "packages/*"\n\ncatalog:\n${yamlCatalog}\n`;
  if (packageManager === 'yarn')
    files['.yarnrc.yml'] =
      `nodeLinker: node-modules\n\ncatalog:\n${yamlCatalog}\n`;
  // Start's dev middleware needs Vite to have one module identity across plugins.
  if (packageManager === 'bun' && requirements.has('@tanstack/react-start'))
    files['bunfig.toml'] = '[install]\nlinker = "hoisted"\n';
  const turbo = JSON.parse(files['turbo.json']) as {
    tasks: Record<string, Record<string, unknown>>;
  };
  turbo.tasks.dev.dependsOn = ['^build'];
  files['turbo.json'] = JSON.stringify(turbo, null, 2);
}
