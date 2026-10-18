'use client';

import { CheckIcon, CircleXIcon, CopyIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ComponentProps } from 'react';

import { IconSwap, IconSwapItem } from '@/components/ncdai/icon-swap';
import { Button } from '@/components/ui/button';
import type { CopyState } from '@/hooks/use-copy';
import { useCopy } from '@/hooks/use-copy';
import { cn } from '@/lib/utils';

export type CopyStateIconProps = {
  state: CopyState;
  /** Custom icon for idle state. */
  idleIcon?: React.ReactNode;
  /** Custom icon for done state. */
  doneIcon?: React.ReactNode;
  /** Custom icon for error state. */
  errorIcon?: React.ReactNode;
};

export function CopyStateIcon({
  state,
  idleIcon,
  doneIcon,
  errorIcon,
}: CopyStateIconProps) {
  return (
    <IconSwap>
      <IconSwapItem key={state} as={motion.span}>
        {state === 'idle' && (idleIcon ?? <CopyIcon data-slot="idle-icon" />)}

        {state === 'done' && (doneIcon ?? <CheckIcon data-slot="done-icon" />)}

        {state === 'error' &&
          (errorIcon ?? <CircleXIcon data-slot="error-icon" />)}
      </IconSwapItem>
    </IconSwap>
  );
}

export type CopyButtonProps = ComponentProps<typeof Button> & {
  /** The text to copy, or a function that returns the text. */
  text: string | (() => string);
  /** Called with the copied text on successful copy. */
  onCopySuccess?: (text: string) => void;
  /** Called with the error if the copy operation fails. */
  onCopyError?: (error: Error) => void;
} & Omit<CopyStateIconProps, 'state'>;

export function CopyButton({
  className,
  size = 'icon',
  children,
  text,
  idleIcon,
  doneIcon,
  errorIcon,
  onClick,
  onCopySuccess,
  onCopyError,
  ...props
}: CopyButtonProps) {
  const { state, copy } = useCopy({
    onCopySuccess,
    onCopyError,
  });

  return (
    <Button
      className={cn('text-muted-foreground will-change-transform', className)}
      size={size}
      onClick={(e) => {
        copy(text);
        onClick?.(e);
      }}
      aria-label="Copy"
      {...props}
    >
      <CopyStateIcon
        data-icon="inline-start"
        state={state}
        idleIcon={idleIcon}
        doneIcon={doneIcon}
        errorIcon={errorIcon}
      />
      {children}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {state === 'done' ? 'Copied' : state === 'error' ? 'Copy failed' : ''}
      </span>
    </Button>
  );
}
