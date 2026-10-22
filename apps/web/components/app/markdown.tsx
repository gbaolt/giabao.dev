import ReactMarkdown from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { UTM_PARAMS } from '@/config/site';
import { rehypeAddQueryParams } from '@/lib/rehype-add-query-params';

export function Markdown(props: React.ComponentProps<typeof ReactMarkdown>) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeExternalLinks, { target: '_blank', rel: 'nofollow noopener' }],
        [rehypeAddQueryParams, UTM_PARAMS],
      ]}
      {...props}
    />
  );
}
