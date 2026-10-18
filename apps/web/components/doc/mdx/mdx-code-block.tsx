import type { ComponentProps } from 'react';

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockPre,
  CodeBlockTitle,
  CodeBlockWrapButton,
} from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

import { getIconExtension } from './extensions/get-icon';

function CodeActions({ raw }: { raw?: string }) {
  return (
    <CodeBlockActions>
      <CodeBlockWrapButton />
      {raw !== undefined && <CodeBlockCopyButton value={raw} />}
    </CodeBlockActions>
  );
}

function CodeHeader({
  raw,
  children,
  ...props
}: ComponentProps<typeof CodeBlockHeader> & {
  raw?: string;
}) {
  const language =
    'data-language' in props && typeof props['data-language'] === 'string'
      ? props['data-language']
      : undefined;
  return (
    <CodeBlockHeader {...props}>
      {language && getIconExtension(language)}
      <CodeBlockTitle>{children}</CodeBlockTitle>
      <CodeActions raw={raw} />
    </CodeBlockHeader>
  );
}

export const mdxCodeBlockComponents = {
  figure({
    __rawString__,
    __wrap__,
    __withMeta__,
    children,
    ...props
  }: ComponentProps<'figure'> & {
    __rawString__?: string;
    __wrap__?: boolean;
    __withMeta__?: boolean;
  }) {
    if (!('data-rehype-pretty-code-figure' in props)) {
      return <figure {...props}>{children}</figure>;
    }
    return (
      <CodeBlock {...props} defaultWrap={__wrap__}>
        {!__withMeta__ && <CodeActions raw={__rawString__} />}
        {children}
      </CodeBlock>
    );
  },
  figcaption({
    children,
    __rawString__,
    ...props
  }: ComponentProps<'figcaption'> & { __rawString__?: string }) {
    if (!('data-rehype-pretty-code-title' in props)) {
      return <figcaption {...props}>{children}</figcaption>;
    }
    return (
      <CodeHeader render={<figcaption />} {...props} raw={__rawString__}>
        {children}
      </CodeHeader>
    );
  },
  div({
    children,
    __rawString__,
    ...props
  }: ComponentProps<'div'> & { __rawString__?: string }) {
    if (!('data-rehype-pretty-code-title' in props)) {
      return <div {...props}>{children}</div>;
    }
    return (
      <CodeHeader {...props} raw={__rawString__}>
        {children}
      </CodeHeader>
    );
  },
  pre(props: ComponentProps<'pre'>) {
    return <CodeBlockPre {...props} />;
  },
};

export function MDXCodeBlock({
  language,
  title,
  html,
  raw,
  className,
}: {
  language: string;
  title?: string;
  html: string | null;
  raw: string;
  className?: string;
}) {
  return (
    <CodeBlock
      className={cn(
        'my-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        className
      )}
    >
      {title ? (
        <CodeHeader
          render={<figcaption />}
          className="h-10 shrink-0"
          data-language={language}
          raw={raw}
        >
          {title}
        </CodeHeader>
      ) : (
        <CodeActions raw={raw} />
      )}
      {html ? (
        <div
          className="code-block-panel"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <CodeBlockContent>{raw}</CodeBlockContent>
      )}
    </CodeBlock>
  );
}
