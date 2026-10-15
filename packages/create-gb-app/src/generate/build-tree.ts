import type { Stack } from '#/types/stack';

import type {
  FileMap,
  GenerateContext,
  PackageJsonShape,
} from '../types/generate';
import { GenerateError } from './errors';
import { setFile, setFileIfAbsent, sortRecord } from './files';
import { emitBetterAuth } from './layers/better-auth';
import { emitClerk } from './layers/clerk';
import { emitConvex } from './layers/convex';
import { emitDbSetup, finalizeDatabaseSetup } from './layers/db-setup';
import { emitDrizzle } from './layers/drizzle';
import { emitEslint } from './layers/eslint';
import { emitForms } from './layers/forms';
import { emitHono } from './layers/hono';
import { emitLogin } from './layers/login';
import { emitNest } from './layers/nest';
import { emitNext } from './layers/next';
import { emitNotes } from './layers/notes';
import { emitOptionalWorkspace } from './layers/optional-workspace';
import { emitOrpc } from './layers/orpc';
import { emitOxlint } from './layers/oxlint';
import { emitPolar } from './layers/polar';
import { emitPostgres } from './layers/postgres';
import { emitPrisma } from './layers/prisma';
import { emitSelf } from './layers/self';
import { emitShadcn } from './layers/shadcn';
import { emitStart } from './layers/start';
import { emitStartOrpc, validateStartOrpc } from './layers/start-orpc';
import { emitStripe } from './layers/stripe';
import { emitTrpc } from './layers/trpc';
import { emitValidation } from './layers/validation';
import { projectLayout } from './layout';
import { generateReadme } from './readme';
import { finalizeWorkspaces } from './workspaces';

function emitDatabase(
  stack: Extract<Stack, { backend: 'self' | 'nest' }>,
  ctx: Parameters<typeof emitNext>[0]
) {
  if (stack.database === 'none') {
    return;
  }

  switch (stack.database) {
    case 'sqlite':
    case 'mysql':
    case 'postgres':
      emitPostgres(ctx);
      break;
    default: {
      const _exhaustive: never = stack.database;
      throw new Error(`unhandled database: ${_exhaustive}`);
    }
  }

  switch (stack.orm) {
    case 'prisma':
      emitPrisma(ctx);
      break;
    case 'drizzle':
      emitDrizzle(ctx);
      break;
    case 'none':
      throw new Error('orm none requires database none');
    default: {
      const _exhaustive: never = stack.orm;
      throw new Error(`unhandled orm: ${_exhaustive}`);
    }
  }

  emitDbSetup(ctx);
}

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
  switch (stack.linter) {
    case 'eslint':
      emitEslint(ctx);
      break;
    case 'oxlint':
      emitOxlint(ctx);
      break;
    case 'biome':
      throw new GenerateError('biome', 'biome generate is not implemented yet');
    default: {
      const _exhaustive: never = stack.linter;
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
          emitDatabase(stack, emitCtx);
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
        break;
      case 'hono':
        emitHono(emitCtx);
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

  if (stack.structure === 'single') {
    emitAuth(stack, emitCtx);
    emitPayments(stack, emitCtx);
    emitLinter(stack, emitCtx);
    if (stack.backend === 'convex' || stack.database !== 'none') {
      emitNotes(emitCtx);
    }
    const providerPath =
      stack.frontend === 'next'
        ? 'app/providers.tsx'
        : 'src/components/providers.tsx';
    setFileIfAbsent(
      files,
      providerPath,
      `import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return children;
}
`
    );
  } else if (stack.backend === 'nest') {
    if (stack.auth === 'clerk') {
      emitClerk(emitCtx);
    }
    emitPayments(stack, emitCtx);
  }

  if (foundations) {
    emitUi(stack, emitCtx);
    emitValidation(emitCtx);
    emitForms(emitCtx);
    emitLogin(emitCtx);
    finalizeDatabaseSetup(emitCtx);
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
