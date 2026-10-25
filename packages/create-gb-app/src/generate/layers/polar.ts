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
  const authPath = ctx.layout.authFile;
  const current = ctx.files[authPath] ?? '';
  if (!current || current.includes('@polar-sh/better-auth')) {
    return;
  }
  setFile(ctx.files, authPath, injectPolarPlugin(current));
}

function injectPolarPlugin(source: string): string {
  let next = source.includes('from "@polar-sh/better-auth"')
    ? source
    : source.replace(
        'from "better-auth";',
        `from "better-auth";
import { polar } from "@polar-sh/better-auth";`
      );

  if (next.includes('plugins: [')) {
    return next.replace('plugins: [', `plugins: [\n    ${POLAR_PLUGIN}, `);
  }

  return next.replace(
    'betterAuth({',
    `betterAuth({
  plugins: [
    ${POLAR_PLUGIN},
  ],`
  );
}
