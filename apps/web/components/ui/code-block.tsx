'use client';

import './code-block.css';

import { useRender } from '@base-ui/react/use-render';
import { WrapTextIcon } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type Dispatch,
  type SetStateAction,
  use,
  useState,
} from 'react';

import { CopyButton } from '@/components/ncdai/copy-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CodeBlockContext = createContext<{
  wrap: boolean;
  setWrap: Dispatch<SetStateAction<boolean>>;
} | null>(null);

function CodeBlock({
  className,
  defaultWrap = false,
  children,
  ...props
}: ComponentProps<'figure'> & { defaultWrap?: boolean }) {
  const [wrap, setWrap] = useState(defaultWrap);

  return (
    <CodeBlockContext value={{ wrap, setWrap }}>
      <figure
        {...props}
        data-slot="code-block"
        data-wrap={wrap || undefined}
        className={cn('code-block not-typeset', className)}
      >
        {children}
      </figure>
    </CodeBlockContext>
  );
}

function CodeBlockHeader({
  render,
  ref,
  ...props
}: useRender.ComponentProps<'figcaption'>) {
  return useRender({
    defaultTagName: 'div',
    render,
    ref,
    props: { ...props, 'data-slot': 'code-block-header' },
  });
}

function CodeBlockTitle(props: ComponentProps<'span'>) {
  return <span {...props} data-slot="code-block-title" />;
}

function CodeBlockActions(props: ComponentProps<'div'>) {
  return <div {...props} data-slot="code-block-actions" />;
}

const actionClassName =
  "text-muted-foreground rounded-md border-none [&_svg:not([class*='size-'])]:size-4";

function CodeBlockCopyButton({
  value,
  className,
  ...props
}: Omit<ComponentProps<typeof CopyButton>, 'text'> & { value: string }) {
  return (
    <CopyButton
      variant="ghost"
      size="icon-xs"
      {...props}
      data-slot="code-block-copy-button"
      className={cn(actionClassName, className)}
      text={value}
    />
  );
}

function CodeBlockWrapButton() {
  const context = use(CodeBlockContext);
  if (!context) throw new Error('CodeBlockWrapButton requires a CodeBlock');

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={actionClassName}
      aria-label="Wrap lines"
      aria-pressed={context.wrap}
      onClick={() => context.setWrap((wrap) => !wrap)}
    >
      <WrapTextIcon />
    </Button>
  );
}

// Prepared MDX already owns its code element; share the panel without nesting it.
function CodeBlockPre(props: ComponentProps<'pre'>) {
  return (
    <div className="code-block-panel">
      <pre dir="ltr" tabIndex={0} {...props} data-slot="code-block-content" />
    </div>
  );
}

function CodeBlockContent({
  children,
  lineNumbers = false,
  startLine = 1,
  wrap,
  ...props
}: ComponentProps<'pre'> & {
  lineNumbers?: boolean;
  startLine?: number;
  wrap?: boolean;
}) {
  return (
    <CodeBlockPre {...props} data-wrap={wrap}>
      <code
        data-slot="code-block-code"
        data-line-numbers={lineNumbers ? '' : undefined}
        style={
          lineNumbers ? { counterReset: `line ${startLine - 1}` } : undefined
        }
      >
        {lineNumbers && typeof children === 'string'
          ? children
              .replace(/\n$/, '')
              .split('\n')
              .map((line, index) => (
                <CodeBlockLine key={index}>{line}</CodeBlockLine>
              ))
          : children}
      </code>
    </CodeBlockPre>
  );
}

function CodeBlockLine({
  variant = 'default',
  children,
  ...props
}: ComponentProps<'span'> & {
  variant?: 'default' | 'highlighted' | 'added' | 'removed';
}) {
  const changed = variant === 'added' || variant === 'removed';
  return (
    <span
      {...props}
      data-slot="code-block-line"
      data-line=""
      data-variant={variant}
    >
      {changed && (
        <>
          <span aria-hidden="true" className="code-block-diff-marker">
            {variant === 'added' ? '+' : '−'}
          </span>
          <span className="sr-only select-none">
            {variant === 'added' ? 'Added line: ' : 'Removed line: '}
          </span>
        </>
      )}
      {children === '' ||
      children === undefined ||
      children === null ||
      (Array.isArray(children) && children.length === 0)
        ? '\n'
        : children}
    </span>
  );
}

export {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockPre,
  CodeBlockTitle,
  CodeBlockWrapButton,
};
