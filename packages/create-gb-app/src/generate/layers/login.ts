import type { EmitCtx } from '../../types/generate';
import loginSource from '../assets/login/source.json';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { addDependencies } from '../project-model';
import { fillTemplate } from '../template-tokens';
import { startOrpcLoginRoute } from './start-orpc-auth';

export function emitLogin(ctx: EmitCtx): void {
  if (ctx.stack.auth !== 'better-auth') return;

  const isNext = ctx.stack.frontend === 'next';
  const webRoot = ctx.layout.frontendRoot ? `${ctx.layout.frontendRoot}/` : '';
  const sourceRoot = webRoot + (isNext ? '' : 'src/');
  const pagePath = isNext
    ? `${webRoot}app/login/page.tsx`
    : `${sourceRoot}routes/login.tsx`;
  // A separate server never renders pages, so the web app always owns login.
  if (!(pagePath in ctx.files) && ctx.layout.backendRoot !== 'apps/server')
    return;

  addDependencies(ctx.project, ctx.layout.frontendManifest, {
    'lucide-react': DEPENDENCY_VERSIONS['lucide-react'],
  });

  const ui =
    ctx.layout.structure === 'single' ? '@/components/ui/' : '@repo/ui/';
  setFile(
    ctx.files,
    `${sourceRoot}components/login-form.tsx`,
    fillTemplate(loginSource.forms[ctx.stack.addons.form], { UI_PREFIX: ui })
  );

  const page = isNext
    ? loginSource.pages.next
    : loginSource.pages['tanstack-start'];
  const projectNameLiteral =
    "'" +
    JSON.stringify(ctx.projectName).slice(1, -1).replaceAll("'", "\\'") +
    "'";
  setFile(
    ctx.files,
    pagePath,
    ctx.stack.backend === 'self' &&
      ctx.stack.frontend === 'tanstack-start' &&
      ctx.stack.api === 'orpc'
      ? startOrpcLoginRoute(projectNameLiteral)
      : fillTemplate(page, { PROJECT_NAME: projectNameLiteral })
  );
}
