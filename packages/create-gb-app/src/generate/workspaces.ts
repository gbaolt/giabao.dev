import type { FileMap, PackageManager } from '#/types/generate';

import { DEPENDENCY_VERSIONS } from './dependency-versions';
import { PACKAGE_MANAGER_METADATA } from './package-managers';
import type { Manifest } from './project-model';

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;
const WORKSPACE_PATTERNS = ['apps/*', 'packages/*'];
// pnpm 10 builds only `onlyBuiltDependencies`; pnpm 11 fails the install unless
// `allowBuilds` decides every dependency that has a build script.
const BUILT_DEPENDENCIES = [
  '@prisma/engines',
  '@tailwindcss/oxide',
  'better-sqlite3',
  'esbuild',
  'prisma',
  'sharp',
  'unrs-resolver',
];
// The client's postinstall reruns `prisma generate`, which `db:generate` already does
// and which fails under pnpm on Windows.
const PNPM_BUILD_APPROVALS = `allowBuilds:\n  "@prisma/client": false\n${BUILT_DEPENDENCIES.map((name) => `  ${JSON.stringify(name)}: true`).join('\n')}\nonlyBuiltDependencies:\n${BUILT_DEPENDENCIES.map((name) => `  - ${JSON.stringify(name)}`).join('\n')}\n`;

/**
 * Folds workspace links and the shared catalog into the manifests, in place,
 * and returns the package manager's workspace files.
 */
export function finalizeWorkspaces(
  byPath: Record<string, Manifest>,
  packageManager: PackageManager
): FileMap {
  const files: FileMap = {};
  const manifests = Object.entries(byPath).map(([path, manifest]) => ({
    path,
    manifest,
  }));
  const root = byPath['package.json'];
  if (!root?.workspaces) {
    if (packageManager === 'pnpm')
      files['pnpm-workspace.yaml'] = PNPM_BUILD_APPROVALS;
    return files;
  }

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
      manifest.packageManager = `${packageManager}@${PACKAGE_MANAGER_METADATA[packageManager].version}`;
      manifest.workspaces =
        packageManager === 'bun'
          ? { packages: WORKSPACE_PATTERNS, catalog }
          : WORKSPACE_PATTERNS;
    }
  }

  const yamlCatalog = Object.entries(catalog)
    .map(
      ([name, version]) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`
    )
    .join('\n');
  if (packageManager === 'pnpm')
    files['pnpm-workspace.yaml'] =
      `packages:\n  - "apps/*"\n  - "packages/*"\n\ncatalog:\n${yamlCatalog}\n\n${PNPM_BUILD_APPROVALS}`;
  if (packageManager === 'yarn')
    files['.yarnrc.yml'] =
      `nodeLinker: node-modules\n\ncatalog:\n${yamlCatalog}\n`;
  // Start's dev middleware needs Vite to have one module identity across plugins.
  if (packageManager === 'bun' && requirements.has('@tanstack/react-start'))
    files['bunfig.toml'] = '[install]\nlinker = "hoisted"\n';
  return files;
}
