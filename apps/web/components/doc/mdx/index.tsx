import { remarkHeading } from 'fumadocs-core/mdx-plugins/remark-heading';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSlug from 'rehype-slug';
import remarkCodeImport from 'remark-code-import';
import remarkGfm from 'remark-gfm';

import { UTM_PARAMS } from '@/config/site';
import { rehypeAddQueryParams } from '@/lib/rehype-add-query-params';
import {
  rehypeCodeRawString,
  rehypeHighlightCode,
  rehypeHighlightCodeRawString,
} from '@/lib/rehype-code-block';

import { mdxComponents } from './components';

export { getIconExtension } from './extensions/get-icon';
export { MDXCodeBlock, mdxCodeBlockComponents } from './mdx-code-block';

const options: MDXRemoteProps['options'] = {
  mdxOptions: {
    remarkPlugins: [
      remarkGfm,
      [remarkCodeImport, { async: false, rootDir: process.cwd() }],
      remarkHeading,
    ],
    rehypePlugins: [
      [rehypeExternalLinks, { target: '_blank', rel: 'nofollow noopener' }],
      rehypeSlug,
      rehypeCodeRawString,
      rehypeHighlightCode,
      rehypeHighlightCodeRawString,
      [rehypeAddQueryParams, UTM_PARAMS],
    ],
  },
};

export function MDX({ content }: { content: string }) {
  return (
    <MDXRemote
      // remark-code-import requires VFile.dirname. A string source has none.
      source={{ value: content, path: 'mdx.mdx' }}
      components={mdxComponents}
      options={options}
    />
  );
}
