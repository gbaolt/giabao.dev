import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { joinPath } from '../layout';
import { addEnv } from '../project-model';
import { emitPortalPage } from './portal';

export function emitStripe(ctx: EmitCtx): void {
  ctx.pkg.dependencies.stripe = DEPENDENCY_VERSIONS['stripe'];
  const { layout } = ctx;
  const handler = (name: string) =>
    layout.backendRoot === 'apps/server'
      ? joinPath(layout.serverSourceRoot, `stripe.${name}.ts`)
      : layout.apiRoute(`stripe/${name}`);
  const webhookPath = handler('webhook');
  const checkoutPath = handler('checkout');

  setFile(
    ctx.files,
    webhookPath,
    `export async function POST(request: Request) {
  const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY as string);
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("missing signature", { status: 400 });
  }
  stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET as string);
  return new Response("ok");
}
`
  );
  emitPortalPage(
    ctx,
    `    <main>
      <h1>Customer portal</h1>
      <form action="/api/stripe/portal" method="post">
        <button type="submit">Open portal</button>
      </form>
    </main>`
  );
  setFile(
    ctx.files,
    checkoutPath,
    `export async function POST() {
  const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY as string);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: "http://localhost:3000/notes",
    cancel_url: "http://localhost:3000/notes",
  });
  return Response.redirect(session.url ?? "/notes", 303);
}
`
  );

  addEnv(ctx.project, {
    STRIPE_SECRET_KEY: 'sk_test_replace_me',
    STRIPE_WEBHOOK_SECRET: 'whsec_replace_me',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  });
}
