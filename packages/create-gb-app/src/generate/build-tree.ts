import type { Stack } from '#/types/stack';

import type {
  FileMap,
  GenerateContext,
  PackageJsonShape,
} from '../types/generate';
import { emitTurborepo } from './addons/turborepo';
import { GenerateError } from './errors';
import { setFile, setFileIfAbsent, sortRecord } from './files';
import { emitBetterAuth } from './layers/better-auth';
import { emitClerk } from './layers/clerk';
import { emitConvex } from './layers/convex';
import { emitDatabase } from './layers/database';
import { finalizeDatabaseSetup } from './layers/db-setup';
import { emitEslint } from './layers/eslint';
import { emitForms } from './layers/forms';
import { emitHono } from './layers/hono';
import { emitLogin } from './layers/login';
import { emitNest } from './layers/nest';
import { emitNext } from './layers/next';
import { emitOptionalWorkspace } from './layers/optional-workspace';
import { emitOrpc } from './layers/orpc';
import { emitOxlint } from './layers/oxlint';
import { emitPolar } from './layers/polar';
import { emitSelf } from './layers/self';
import { emitServerWebApp } from './layers/server-workspace';
import { emitShadcn } from './layers/shadcn';
import { emitStart } from './layers/start';
import { emitStartOrpc, validateStartOrpc } from './layers/start-orpc';
import { emitStripe } from './layers/stripe';
import { emitTrpc } from './layers/trpc';
import { emitValidation } from './layers/validation';
import { projectLayout } from './layout';
import { emitNotes } from './notes';
import { generateReadme } from './readme';
import { emitPlainWorkspace, prepareWorkspaceTasks } from './workspace-tasks';
import { finalizeWorkspaces } from './workspaces';

function emitAuth(stack: Stack, ctx: Parameters<typeof emitNext>[0]) {
  switch (stack.auth) {
    case 'better-auth':
      emitBetterAuth(ctx);
      break;
    case 'none':
      break;
    case 'clerk':
      emitClerk(ctx);
      break;
    default: {
      const _exhaustive: never = stack.auth;
      throw new Error(`unhandled auth: ${_exhaustive}`);
    }
  }
}

function emitUi(_stack: Stack, ctx: Parameters<typeof emitNext>[0]) {
  emitShadcn(ctx);
}

function emitLinter(stack: Stack, ctx: Parameters<typeof emitNext>[0]) {
  switch (stack.addons.linting) {
    case 'eslint':
      emitEslint(ctx);
      break;
    case 'oxlint':
      emitOxlint(ctx);
      break;
    case 'biome':
      throw new GenerateError('biome', 'biome generate is not implemented yet');
    default: {
      const _exhaustive: never = stack.addons.linting;
      throw new Error(`unhandled linter: ${_exhaustive}`);
    }
  }
}

function emitPayments(stack: Stack, ctx: Parameters<typeof emitNext>[0]) {
  switch (stack.payments) {
    case 'none':
      break;
    case 'stripe':
      emitStripe(ctx);
      break;
    case 'polar':
      emitPolar(ctx);
      break;
    default: {
      const _exhaustive: never = stack.payments;
      throw new Error(`unhandled payments: ${_exhaustive}`);
    }
  }
}

function emitFrontend(stack: Stack, ctx: Parameters<typeof emitNext>[0]) {
  switch (stack.frontend) {
    case 'next':
      emitNext(ctx);
      break;
    case 'tanstack-start':
      emitStart(ctx);
      break;
    default: {
      const _exhaustive: never = stack.frontend;
      throw new Error(`unhandled frontend: ${_exhaustive}`);
    }
  }
}

function emitApi(
  stack: Extract<Stack, { backend: 'self' }>,
  ctx: Parameters<typeof emitNext>[0]
) {
  switch (stack.api) {
    case 'orpc':
      if (stack.frontend === 'tanstack-start') emitStartOrpc(ctx);
      else emitOrpc(ctx);
      break;
    case 'trpc':
      emitTrpc(ctx);
      break;
    case 'none':
      break;
    default: {
      const _exhaustive: never = stack.api;
      throw new Error(`unhandled api: ${_exhaustive}`);
    }
  }
}

function buildProject(
  stack: Stack,
  ctx: GenerateContext,
  foundations: boolean
): FileMap {
  const files: FileMap = {};
  const pkg: PackageJsonShape = {
    name: ctx.projectName,
    private: true,
    type: 'module',
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
  const layout = projectLayout(stack);
  const emitCtx = { ...ctx, files, pkg, stack, layout };

  if (stack.structure === 'single') {
    switch (stack.backend) {
      case 'self': {
        emitSelf(emitCtx);
        emitFrontend(stack, emitCtx);
        if (stack.database !== 'none') {
          if (stack.api !== 'none') {
            emitApi(stack, emitCtx);
          }
          emitDatabase(emitCtx);
        }
        break;
      }
      case 'convex':
        emitFrontend(stack, emitCtx);
        emitConvex(emitCtx);
        break;
      default:
        throw new Error(
          `unsupported single-app backend: ${JSON.stringify(stack)}`
        );
    }
  } else {
    switch (stack.backend) {
      case 'nest':
        emitNest(emitCtx);
        emitServerWebApp(emitCtx, (webCtx) => emitFrontend(stack, webCtx));
        break;
      case 'hono':
        emitHono(emitCtx);
        emitServerWebApp(emitCtx, (webCtx) => emitFrontend(stack, webCtx));
        break;
      case 'self':
      case 'convex':
        emitOptionalWorkspace(emitCtx, (singleStack, context) =>
          buildProject(singleStack, context, false)
        );
        break;
      default:
        throw new Error(
          `unsupported Turborepo backend: ${JSON.stringify(stack)}`
        );
    }
  }

  if (stack.backend === 'nest') {
    emitAuth(stack, emitCtx);
    emitPayments(stack, emitCtx);
    emitNotes(emitCtx);
  } else if (stack.backend === 'hono') {
    emitAuth(stack, emitCtx);
    emitNotes(emitCtx);
  }

  if (stack.structure === 'single') {
    emitAuth(stack, emitCtx);
    emitPayments(stack, emitCtx);
    emitLinter(stack, emitCtx);
    emitNotes(emitCtx);
  }
  if (stack.structure === 'single' || layout.backendRoot === 'apps/server') {
    setFileIfAbsent(
      files,
      layout.providersFile,
      `import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return children;
}
`
    );
  }

  if (foundations) {
    emitUi(stack, emitCtx);
    emitValidation(emitCtx);
    emitForms(emitCtx);
    emitLogin(emitCtx);
    finalizeDatabaseSetup(emitCtx);
  }

  if (stack.structure === 'monorepo') {
    const workspaces = prepareWorkspaceTasks(emitCtx);
    if (stack.addons.taskRunner === 'turborepo')
      emitTurborepo(emitCtx, workspaces);
    else emitPlainWorkspace(emitCtx, workspaces);
  }

  pkg.dependencies = sortRecord(pkg.dependencies);
  pkg.devDependencies = sortRecord(pkg.devDependencies);
  pkg.scripts = sortRecord(pkg.scripts);
  setFile(files, 'package.json', JSON.stringify(pkg, null, 2));
  finalizeWorkspaces(files, ctx.packageManager);
  if (foundations) {
    setFile(files, 'README.md', generateReadme(stack, ctx, files, pkg));
  }
  return files;
}

export function buildTree(stack: Stack, ctx: GenerateContext): FileMap {
  validateStartOrpc(stack);
  return buildProject(stack, ctx, true);
}
