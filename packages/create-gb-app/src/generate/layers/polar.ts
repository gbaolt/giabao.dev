import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

const POLAR_PLUGIN = `polar({
      createCustomerOnSignUp: true,
      products: [{ slug: "pro", name: "Pro" }],
    })`;

export function emitPolar(ctx: EmitCtx): void {
  ctx.pkg.dependencies['@polar-sh/better-auth'] =
    DEPENDENCY_VERSIONS['@polar-sh/better-auth'];
  setFile(
    ctx.files,
    ctx.layout.route('portal'),
    `export default function PortalPage() {
  return (
    <main>
      <h1>Polar portal</h1>
      <p>Product: pro</p>
    </main>
  );
}
`
  );
  ctx.project.authPlugins.push({
    name: 'polar',
    from: '@polar-sh/better-auth',
    call: POLAR_PLUGIN,
  });
}
