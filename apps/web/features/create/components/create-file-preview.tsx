'use client';

import { useEffect, useState } from 'react';
import {
  type BundledLanguage,
  bundledLanguages,
  createHighlighter,
  type ShikiTransformer,
} from 'shiki/bundle/web';

import { MDXCodeBlock } from '@/components/doc/mdx/mdx-code-block';

import { languageFromPath } from '../lib/language-from-path';

const LANG_BY_EXT: Record<string, BundledLanguage> = {
  css: 'css',
  env: 'shell',
  html: 'html',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  md: 'markdown',
  mdx: 'mdx',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
};

const HIGHLIGHT_LANGS = [...new Set(Object.values(LANG_BY_EXT))].filter(
  (lang) => lang in bundledLanguages
);

const highlighterPromise = createHighlighter({
  langs: HIGHLIGHT_LANGS,
  themes: ['github-light', 'github-dark'],
});

const highlightCache = new Map<string, string>();

const dataLineTransformer: ShikiTransformer = {
  name: 'data-line',
  pre(node) {
    node.properties.tabIndex = 0;
    node.properties.dir = 'ltr';
  },
  line(node) {
    node.properties['data-line'] = '';
  },
};

export function CreateFilePreview({
  file,
}: {
  file: { path: string; contents: string };
}) {
  const path = file?.path;
  const contents = file?.contents;
  const lang = path ? langFromPath(path) : null;
  const cacheKey =
    lang && contents !== undefined ? `${lang}\0${contents}` : null;
  const cached = cacheKey ? highlightCache.get(cacheKey) : undefined;
  const [html, setHtml] = useState<string | null>(cached ?? null);
  const markup = cached ?? html;

  useEffect(() => {
    if (!cacheKey || !lang || contents === undefined) {
      return;
    }

    let cancelled = false;
    const pending = highlightCache.has(cacheKey)
      ? Promise.resolve(highlightCache.get(cacheKey) ?? '')
      : highlighterPromise
          .then((highlighter) =>
            highlighter.codeToHtml(contents, {
              lang,
              themes: {
                light: 'github-light',
                dark: 'github-dark',
              },
              defaultColor: false,
              transformers: [dataLineTransformer],
            })
          )
          .then((next) => {
            highlightCache.set(cacheKey, next);
            return next;
          });

    void pending
      .then((next) => {
        if (!cancelled && next) {
          setHtml(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, contents, lang]);

  return (
    <MDXCodeBlock
      language={languageFromPath(file.path)}
      title={fileName(file.path)}
      html={markup}
      raw={file.contents}
      className="my-0 h-full min-h-0"
    />
  );
}

function fileName(path: string) {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return slash === -1 ? path : path.slice(slash + 1);
}

function langFromPath(path: string): BundledLanguage | null {
  return LANG_BY_EXT[languageFromPath(path)] ?? null;
}
