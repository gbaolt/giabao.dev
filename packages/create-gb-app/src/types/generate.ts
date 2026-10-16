import type { ProjectLayout } from '#/generate/layout';
import type { Stack } from '#/types/stack';

export type FileMap = Record<string, string>;

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type GenerateContext = {
  projectName: string;
  packageManager: PackageManager;
};

export type PackageJsonShape = {
  name: string;
  private: true;
  type: 'module';
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  workspaces?:
    string[] | { packages: string[]; catalog: Record<string, string> };
  packageManager?: string;
  engines?: { node: string };
};

export type EmitCtx = GenerateContext & {
  files: FileMap;
  pkg: PackageJsonShape;
  stack: Stack;
  layout: ProjectLayout;
};
