import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';

/** Writes the payments portal page in the frontend's routing convention. */
export function emitPortalPage(ctx: EmitCtx, main: string): void {
  const page = `function PortalPage() {
  return (
${main}
  );
}
`;
  setFile(
    ctx.files,
    ctx.layout.route('portal'),
    ctx.stack.frontend === 'next'
      ? `export default ${page}`
      : `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  component: PortalPage,
});

${page}`
  );
}
