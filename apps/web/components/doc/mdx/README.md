# Code blocks

Blog Docs keep server-side syntax highlighting through rehype-pretty-code. Create
file previews keep their existing Shiki pipeline. Both share the locally adapted
[shadcn CodeBlock](https://ui.shadcn.com/docs/components/base/code-block)
components and the site's animated CopyButton.

## Authoring a Doc

Code scrolls horizontally by default. Each block has a Wrap lines toggle beside
Copy. Add the standalone `wrap` flag to start a block wrapped:

````md
```ts title="example.ts" wrap showLineNumbers
const description = 'A long example that readers can wrap or scroll.';
```
````

Existing titles, captions, highlighted characters, numeric line ranges, and
numbered lines continue working. A word inside a title, caption, or character
highlight does not enable wrapping.

Mark changed lines using rehype-pretty-code's existing named line groups:

````md
```ts title="example.ts" {1}#removed {2}#added
const count = 1;
const count = 2;
```
````

The reserved group IDs `added` and `removed` add a marker and a line background.
Other IDs retain ordinary highlighting. Use disjoint ranges; if ranges overlap,
rehype-pretty-code uses the first matching group. Wrapping preserves the logical
line numbers and markers.

Copy returns every displayed source line in order, including removed lines. It
omits generated numbers, markers, and accessibility labels. It does not apply a
patch or produce only the final version. Each context retains its existing source
normalization, including the setup guide's package-manager command replacement.

## Composing another code display

Use `CodeBlock`, `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockActions`,
`CodeBlockContent`, and `CodeBlockLine` from the UI component module. Compose
`CodeBlockWrapButton` and `CodeBlockCopyButton` in the actions. Supply the original
source to the copy button's `value` prop.

`CodeBlock` owns the wrap toggle's state; `defaultWrap` sets its initial value.
`CodeBlockContent` accepts plain text or composed lines, plus the upstream `wrap`,
`lineNumbers`, and `startLine` options. An explicit `wrap` on content controls that
content independently; omit it when using the built-in wrap toggle.

`CodeBlockLine` accepts `default`, `highlighted`, `added`, or `removed` variants.
These components do not compute diffs or perform syntax highlighting.

The MDX adapter uses `CodeBlockPre` because its children already contain a code
element. Prepared highlighted HTML remains inside the existing trusted Create
adapter. Do not nest another pre/code pair or accept arbitrary untrusted HTML.

## Verification

Run the MDX integration fixtures with:

```sh
bun run --filter web test components/doc/mdx/mdx-code-block.test.tsx
```

Check interactions on `https://gbaolt.localhost`: blog Docs, Create file previews,
and the Create setup guide. Include light/dark and narrow touch layouts, copy
success and rejection, file/package-manager changes, and keyboard scrolling.
Arrow keys inside a focused code block must not invoke neighboring-Doc navigation.
Blog lists must continue receiving Doc summaries without MDX bodies.

While `/create` shows its under-construction page, render `CreateWorkspace` in a
temporary local fixture for the preview and setup-guide checks. Remove that
fixture afterward; verifying code blocks does not require publishing Create.
