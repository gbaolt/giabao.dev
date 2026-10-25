import type { Stack } from '#/types/stack';

import type {
  FileMap,
  GenerateContext,
  PackageJsonShape,
} from '../types/generate';
import { emitTurborepo } from './addons/turborepo';
import { GenerateError } from './errors';
import { setFile } from './files';
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
import {
  appCollections,
  applyServerModuleFormat,
  createProjectModel,
  manifestAt,
  type ProjectModel,
  renderAppFiles,
  renderProject,
} from './project-model';
import { generateReadme } from './readme';
import { emitPlainWorkspace, prepareWorkspaceTasks } from './workspace-tasks';

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
  foundations: boolean,
  project: ProjectModel
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
  project.manifests['package.json'] = pkg;
  const emitCtx = { ...ctx, files, pkg, stack, layout, project };

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
      case 'hono':
        if (stack.backend === 'nest') emitNest(emitCtx);
        else emitHono(emitCtx);
        emitServerWebApp(emitCtx, (webCtx) => emitFrontend(stack, webCtx));
        break;
      case 'self':
      case 'convex':
        emitOptionalWorkspace(emitCtx, (singleStack, context) => {
          // The monorepo writes its own README notes over the inner app's,
          // and the inner app's manifest becomes the web workspace's.
          const inner = { ...project, ...appCollections() };
          const innerFiles = buildProject(singleStack, context, false, inner);
          // Its providers and root document render with the web app's wrappers.
          project.providers = inner.providers;
          project.rootDocument = inner.rootDocument;
          return {
            files: innerFiles,
            manifest: manifestAt(inner, 'package.json'),
          };
        });
        break;
      default:
        throw new Error(
          `unsupported Turborepo backend: ${JSON.stringify(stack)}`
        );
    }
  }

  // Self and Convex monorepos ran these inside their single-app build.
  if (stack.structure === 'single' || layout.backendRoot === 'apps/server') {
    emitAuth(stack, emitCtx);
    emitPayments(stack, emitCtx);
    // The server workspace already chose the linter for every server backend.
    if (stack.structure === 'single') emitLinter(stack, emitCtx);
    emitNotes(emitCtx);
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

  if (!foundations) {
    Object.assign(files, renderAppFiles(project));
    return files;
  }
  Object.assign(
    files,
    renderProject(project, {
      stack,
      layout,
      packageManager: ctx.packageManager,
    })
  );
  applyServerModuleFormat(files, stack, layout);
  setFile(
    files,
    'README.md',
    generateReadme(
      stack,
      ctx,
      files,
      JSON.parse(files['package.json']!) as PackageJsonShape,
      project.readmeSections
    )
  );
  return files;
}

export function buildTree(stack: Stack, ctx: GenerateContext): FileMap {
  validateStartOrpc(stack);
  return buildProject(stack, ctx, true, createProjectModel());
}
