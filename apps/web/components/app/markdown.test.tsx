import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Markdown } from './markdown';

test('renders portfolio Markdown without suspending and preserves its plugins', () => {
  const html = renderToStaticMarkup(
    <Markdown>
      {
        '~~old~~ **new** [External](https://example.com) [Local](/blog) <em>HTML</em>'
      }
    </Markdown>
  );

  expect(html).toContain('<del>old</del>');
  expect(html).toContain('<strong>new</strong>');
  expect(html).toContain('href="https://example.com/?utm_source=giabao.dev"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="nofollow noopener"');
  expect(html).toContain('href="/blog"');
  expect(html).toContain('<em>HTML</em>');
});
