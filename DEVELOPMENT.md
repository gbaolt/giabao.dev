# Development

This guide outlines the steps required to set up and run the project in a local environment.

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (Latest LTS version recommended)
- [Bun](https://bun.sh/) 1.4.3+ for `bun check`
- [Git](https://git-scm.com/)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gbaolt/giabao.dev.git dev-portfolio
cd dev-portfolio
```

### 2. Install Portless

Documentation: [portless.sh](https://portless.sh)

```bash
bun add -g portless
```

### 3. Install dependencies

```bash
bun install
```

### 4. Configure Environment Variables

Create an `apps/web/.env.local` file based on `apps/web/.env.example`:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Then, update the necessary environment variables inside `apps/web/.env.local`.

### 5. Run the development server

```bash
bun run dev
```

The application should now be available at `https://gbaolt.localhost`.

In development, `/resume.pdf` renders from the current MDX and PDF components on each request. Refresh `/resume` after editing content or PDF styles. Production continues serving the static PDF generated before `next build`.

## Production delivery

Cloudflare hosts DNS. The apex `giabao.dev` A record points to Vercel at
`216.198.79.1` with the proxy disabled (DNS only). Vercel handles HTTPS and the
Next.js CDN cache, including HTML/RSC variants and invalidation. Keep the
framework's `Cache-Control` and `Vary` headers; do not add a Cloudflare HTML cache
rule or replace them with a shared `s-maxage`.

On October 22, 2026, five interleaved homepage GETs had median TTFB of 660 ms
through Cloudflare and 116 ms directly to Vercel. All returned 200 and a Vercel
cache hit. The direct range was 104–1,422 ms, so this is a local comparison,
not a guaranteed saving for every visitor. This follows
[Vercel's Cloudflare guidance](https://vercel.com/kb/guide/cloudflare-with-vercel).

`www.giabao.dev` remains proxied: its direct Vercel certificate failed validation
as expired during the check. Renew and validate that certificate before changing
its proxy setting. `assets.giabao.dev` remains proxied for its R2 custom domain.
The apex uses Vercel's edge protection; Cloudflare WAF rules no longer apply to
that hostname.

After changing DNS, verify HTTPS, the homepage, `/blog`, and an RSC request
(`RSC: 1` with a fresh `_rsc` query). HTML must return `text/html`; RSC must return
`text/x-component`, with its framework cache policy intact. To roll back, enable
the Cloudflare proxy on the existing apex A record without changing its address,
MX or TXT records. A Git revert alone does not change DNS.

## Building for Production

```bash
bun run build
```

After building, start the application with:

```bash
NODE_ENV=production bun run start
```

## Screenshots

The site screenshots are captured locally, then published to Cloudflare R2.

Start the app first:

```bash
bun run dev
```

The app is at `https://gbaolt.localhost`. Then:

```bash
bun run capture       # Capture screenshots into .gbaolt/screenshots
bun run capture:sync  # Upload the folder to Cloudflare R2
```

Set the `R2_*` credentials from `apps/web/.env.example` before running `capture:sync`. The command uploads `.gbaolt/screenshots` to the bucket root (skips dotfiles), replaces keys that already exist, and leaves other remote objects untouched.
