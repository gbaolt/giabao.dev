# shadcn Base UI assets

`source.json` contains unmodified UTF-8 text captured from the official shadcn CLI. The command ran on 2026-09-25 with `shadcn` 4.21.0:

Editable source files live in `packages/create-gb-app/templates/shadcn/`. `formatted-source.json` is generated from those files with `bun run templates:generate` and committed for the CLI and Create to import. Format the templates with this repository's Prettier settings before regenerating. `source.json` remains the unmodified upstream reference, including its unused package manifest.

```sh
shadcn init --name reference --template next --preset b1YnQPagE --base base --no-monorepo --yes
shadcn add input card field textarea select checkbox --yes
shadcn info --json
```

`button` came from `init`. The `field` registry item added `label` and `separator`. The resolved preset is recorded in `metadata.ts`; it came from `info --json`, not manual decoding. The reference project, including `components.json`, CSS, layout, package manifest, and the nine component files, is preserved under `.scratch/create-gb-app-improvements/shadcn-reference/reference/`.

Framework and layout adaptation happens in `layers/shadcn.ts`; do not alter component behavior without checking the official CLI diff first.

Next uses the official Geist setup through `next/font`; TanStack Start loads the same font families through Fontsource and uses the official theme provider. Shared packages expose both component import patterns and explicit directory aliases. The directory aliases avoid CLI 4.21.0's Windows extension stripping when a workspace path contains a dot, and allow adding components from either the app or UI package.
