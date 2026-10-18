import type { LineElement } from 'rehype-pretty-code';
import rehypePrettyCode from 'rehype-pretty-code';
import { visit } from 'unist-util-visit';

import type { UnistNode, UnistTree } from '@/types/unist';

export function rehypeCodeRawString() {
  return (tree: UnistTree) => {
    visit(tree, (node: UnistNode) => {
      if (node?.type === 'element' && node?.tagName === 'pre') {
        if (!node.children || node.children.length === 0) {
          return;
        }

        const codeEl = node.children[0];
        if (codeEl.tagName !== 'code') {
          return;
        }

        node.__rawString__ = codeEl.children?.[0]?.value;
        const meta = codeEl.data?.meta ?? '';
        node.__wrap__ = meta
          .replace(
            /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/(?:\\.|[^/\\])*\//g,
            ''
          )
          .split(/\s+/)
          .includes('wrap');
      }
    });
  };
}

export function rehypeHighlightCode() {
  return rehypePrettyCode({
    theme: {
      dark: 'github-dark',
      light: 'github-light',
    },
    keepBackground: false,
    defaultLang: { block: 'plaintext' },
    onVisitLine(node: LineElement) {
      // Prevent lines from collapsing in `display: grid` mode, and allow empty
      // lines to be copy/pasted
      if (node.children.length === 0) {
        node.children = [{ type: 'text', value: ' ' }];
      }
    },
    onVisitHighlightedLine(node, id) {
      if (id !== 'added' && id !== 'removed') return;
      node.properties['data-variant'] = id;
      node.children.unshift(
        {
          type: 'element',
          tagName: 'span',
          properties: {
            className: ['code-block-diff-marker'],
            ariaHidden: 'true',
          },
          children: [{ type: 'text', value: id === 'added' ? '+' : '−' }],
        },
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['sr-only', 'select-none'] },
          children: [
            {
              type: 'text',
              value: id === 'added' ? 'Added line: ' : 'Removed line: ',
            },
          ],
        }
      );
    },
  });
}

export function rehypeHighlightCodeRawString() {
  return (tree: UnistTree) => {
    visit(tree, (node: UnistNode) => {
      if (node?.type === 'element' && node?.tagName === 'figure') {
        if (
          !node.properties ||
          !('data-rehype-pretty-code-figure' in node.properties)
        ) {
          return;
        }

        if (!node.children || node.children.length === 0) {
          return;
        }

        const title = node.children.find(
          (child) =>
            child.properties &&
            'data-rehype-pretty-code-title' in child.properties
        );
        const preElement = node.children.find(
          (child) => child.tagName === 'pre'
        );
        if (!preElement) {
          return;
        }

        node.properties = {
          ...node.properties,
          __withMeta__: Boolean(title),
          __rawString__: node.__rawString__,
          __wrap__: node.__wrap__,
        };

        if (title) {
          title.properties = {
            ...title.properties,
            __rawString__: node.__rawString__,
          };
        }
      }
    });
  };
}
