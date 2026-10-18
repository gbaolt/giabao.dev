import { expect, test } from 'bun:test';
import { compileMDX } from 'next-mdx-remote/rsc';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from '@/components/ui/code-block';
import {
  rehypeCodeRawString,
  rehypeHighlightCode,
  rehypeHighlightCodeRawString,
} from '@/lib/rehype-code-block';

import { MDXCodeBlock, mdxCodeBlockComponents } from './mdx-code-block';

async function renderFence(
  meta: string,
  raw = 'const before = 1;\n\nconst after = 2;\n',
  language = 'ts'
) {
  const sources: unknown[] = [];
  const { content } = await compileMDX({
    source: `\`\`\`${language} ${meta}\n${raw}\`\`\``,
    options: {
      mdxOptions: {
        rehypePlugins: [
          rehypeCodeRawString,
          rehypeHighlightCode,
          rehypeHighlightCodeRawString,
        ],
      },
    },
    components: {
      ...mdxCodeBlockComponents,
      figure(props: ComponentProps<'figure'> & { __rawString__?: string }) {
        sources.push(props.__rawString__);
        return mdxCodeBlockComponents.figure(props);
      },
    },
  });
  return { html: renderToStaticMarkup(content), sources, raw };
}

test('wrap and named diffs preserve source, one pre/code pair, and existing highlights', async () => {
  const { html, sources, raw } = await renderFence(
    'title="example.ts" wrap showLineNumbers {1}#removed {3}#added /after/'
  );
  expect(html).toContain('data-wrap="true"');
  expect(html).toContain('data-variant="removed"');
  expect(html).toContain('data-variant="added"');
  expect(html).toContain('Removed line:');
  expect(html).toContain('Added line:');
  expect(html).toContain('data-highlighted-chars');
  expect(html).toContain('data-line-numbers');
  expect(html).toContain('aria-label="Wrap lines"');
  expect(html).toContain('tabindex="0"');
  expect(html.match(/<pre\b/g)).toHaveLength(1);
  expect(html.match(/<code\b/g)).toHaveLength(1);
  expect(sources).toEqual([raw]);
});

test.each([
  'title="wrap"',
  'title="a wrap example.ts"',
  'title="src/wrap/file.ts"',
  'caption="please wrap this"',
  '/wrap/',
  '/some wrap text/',
  'filename=wrap',
  '',
])('does not enable wrapping inside other metadata: %s', async (meta) => {
  const { html } = await renderFence(meta);
  expect(html).not.toContain('data-wrap="true"');
});

test('a title and caption keep their semantics and do not lose copy text', async () => {
  const { html, sources, raw } = await renderFence(
    'title="example.ts" caption="An example"'
  );
  expect(html).toContain('data-slot="code-block-header"');
  expect(html).toContain('data-rehype-pretty-code-caption');
  expect(html).toContain('An example');
  expect(html.match(/<figcaption\b/g)).toHaveLength(1);
  expect(sources).toEqual([raw]);
});

test('ordinary groups and overlapping ranges keep the first matching group', async () => {
  const { html } = await renderFence('{1}#note {1,3}#added {3}#removed');
  expect(html).toContain('data-highlighted-line-id="note"');
  expect(html).toContain('data-variant="added"');
  expect(html).not.toContain('data-variant="removed"');
});

test('empty fences remain readable and retain an empty copy payload', async () => {
  const { html, sources } = await renderFence('wrap', '');
  expect(html).toContain('data-wrap="true"');
  expect(html.match(/<pre\b/g)).toHaveLength(1);
  expect(sources).toEqual(['']);
});

test('Create plain text remains escaped and does not add a second code element', () => {
  const html = renderToStaticMarkup(
    <MDXCodeBlock
      language="text"
      title="example.txt"
      raw={'<script>\n\n  text'}
      html={null}
    />
  );
  expect(html).toContain('&lt;script&gt;');
  expect(html.match(/<pre\b/g)).toHaveLength(1);
  expect(html.match(/<code\b/g)).toHaveLength(1);
});

test('ordinary figures and captions do not become code blocks', () => {
  const html = renderToStaticMarkup(
    mdxCodeBlockComponents.figure({
      children: mdxCodeBlockComponents.figcaption({ children: 'A photograph' }),
    })
  );
  expect(html).toContain('<figcaption>A photograph</figcaption>');
  expect(html).not.toContain('code-block');
});

test('a fence without a language keeps its copy source and wrap control', async () => {
  const { html, sources, raw } = await renderFence('', '<example>\n', '');
  expect(html).toContain('aria-label="Wrap lines"');
  expect(html).toContain('&lt;example&gt;');
  expect(sources).toEqual([raw]);
});

test('direct composition supports changed and empty lines without nested code', () => {
  const html = renderToStaticMarkup(
    <CodeBlock>
      <CodeBlockContent lineNumbers startLine={11} wrap>
        <CodeBlockLine variant="removed">before</CodeBlockLine>
        <CodeBlockLine>{[]}</CodeBlockLine>
        <CodeBlockLine variant="added">after</CodeBlockLine>
      </CodeBlockContent>
    </CodeBlock>
  );
  expect(html).toContain('Removed line:');
  expect(html).toContain('Added line:');
  expect(html).toContain('counter-reset:line 10');
  expect(html).toContain('data-line-numbers');
  expect(html.match(/data-line=""/g)).toHaveLength(3);
  expect(html).toContain('\n</span>');
  expect(html.match(/<pre\b/g)).toHaveLength(1);
  expect(html.match(/<code\b/g)).toHaveLength(1);
});

test('numbering plain text keeps blank source lines', () => {
  const html = renderToStaticMarkup(
    <CodeBlock>
      <CodeBlockContent lineNumbers>{'first\n\nlast\n'}</CodeBlockContent>
    </CodeBlock>
  );
  expect(html.match(/data-line=""/g)).toHaveLength(3);
  expect(html).toContain('>first</span>');
  expect(html).toContain('>\n</span>');
  expect(html).toContain('>last</span>');
});

test('the plain fence fallback does not change inline code', async () => {
  const { content } = await compileMDX({
    source: 'Use `count` here.',
    options: {
      mdxOptions: {
        rehypePlugins: [
          rehypeCodeRawString,
          rehypeHighlightCode,
          rehypeHighlightCodeRawString,
        ],
      },
    },
    components: mdxCodeBlockComponents,
  });
  expect(renderToStaticMarkup(content)).toBe(
    '<p>Use <code>count</code> here.</p>'
  );
});
