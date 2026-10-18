'use client';

import { PACKAGE_MANAGER_METADATA } from 'create-gb-app/generate';
import { Children, isValidElement, memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { usePackageManager } from '@/components/ncdai/code-block-command';
import { Prose } from '@/components/ui/typography';

import { mdxComponents } from './components';
import { MDXCodeBlock } from './mdx-code-block';

function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

function replaceCommands(
  value: string,
  manager: keyof typeof PACKAGE_MANAGER_METADATA
) {
  const commands = PACKAGE_MANAGER_METADATA[manager];
  return value
    .replace(/\bbun install\b/g, commands.install)
    .replace(/\bbun run\b/g, commands.run);
}

function ManagerCommand({ children }: { children: string }) {
  const [selected] = usePackageManager();
  return replaceCommands(children, selected === 'prompt' ? 'bun' : selected);
}

function managerText(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === 'string' && /\bbun (?:install|run)\b/.test(child) ? (
      <ManagerCommand>{child}</ManagerCommand>
    ) : (
      child
    )
  );
}

function ManagerCodeBlock({
  language,
  raw,
}: {
  language: string;
  raw: string;
}) {
  const [selected] = usePackageManager();
  return (
    <MDXCodeBlock
      language={language}
      html={null}
      raw={replaceCommands(raw, selected === 'prompt' ? 'bun' : selected)}
      className="my-4 h-auto flex-none"
    />
  );
}

const components: Components = {
  h1: (props) => mdxComponents.h1(withoutNode(props)),
  h2: (props) => mdxComponents.h2(withoutNode(props)),
  h3: (props) => mdxComponents.h3(withoutNode(props)),
  h4: (props) => mdxComponents.h4(withoutNode(props)),
  h5: (props) => mdxComponents.h5(withoutNode(props)),
  h6: (props) => mdxComponents.h6(withoutNode(props)),
  p: ({ node, children, ...props }) => {
    void node;
    return <p {...props}>{managerText(children)}</p>;
  },
  code: (props) => {
    const codeProps = withoutNode(props);
    const language = codeProps.className?.match(/\blanguage-([^\s]+)/)?.[1];
    return mdxComponents.code({
      ...codeProps,
      ...(language ? { 'data-language': language } : {}),
      children:
        typeof codeProps.children === 'string' &&
        /\bbun (?:install|run)\b/.test(codeProps.children) ? (
          <ManagerCommand>{codeProps.children}</ManagerCommand>
        ) : (
          codeProps.children
        ),
    });
  },
  pre: ({ node, children }) => {
    void node;
    const code = isValidElement<{
      children?: unknown;
      className?: string;
    }>(children)
      ? children.props
      : null;
    const language =
      code?.className?.match(/\blanguage-([^\s]+)/)?.[1] ?? 'text';
    const raw =
      typeof code?.children === 'string' ? code.children.trimEnd() : '';

    return <ManagerCodeBlock language={language} raw={raw} />;
  },
};

export const MDXDocument = memo(function MDXDocument({
  content,
}: {
  content: string;
}) {
  return (
    <Prose className="wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeExternalLinks, { target: '_blank', rel: 'nofollow noopener' }],
          rehypeSlug,
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Prose>
  );
});
