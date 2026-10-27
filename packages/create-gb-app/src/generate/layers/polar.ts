import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { addDependencies, addEnv } from '../project-model';
import { emitPortalPage } from './portal';

const POLAR_PLUGIN = `polar({
      client: new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN, server: "sandbox" }),
      createCustomerOnSignUp: true,
      use: [checkout({ products: [{ productId: process.env.POLAR_PRO_PRODUCT_ID as string, slug: "pro" }] })],
    })`;

export function emitPolar(ctx: EmitCtx): void {
  // The plugin belongs with the auth file: the server workspace or the app.
  addDependencies(ctx.project, ctx.layout.backendManifest ?? 'package.json', {
    '@polar-sh/better-auth': DEPENDENCY_VERSIONS['@polar-sh/better-auth'],
    '@polar-sh/sdk': DEPENDENCY_VERSIONS['@polar-sh/sdk'],
  });
  emitPortalPage(
    ctx,
    `    <main>
      <h1>Polar portal</h1>
      <p>Product: pro</p>
    </main>`
  );
  addEnv(ctx.project, {
    POLAR_ACCESS_TOKEN: 'polar_oat_replace_me',
    POLAR_PRO_PRODUCT_ID: 'replace_me',
  });
  ctx.project.authPlugins.push({
    imports: [
      { names: 'checkout, polar', from: '@polar-sh/better-auth' },
      { names: 'Polar', from: '@polar-sh/sdk' },
    ],
    call: POLAR_PLUGIN,
  });
}
