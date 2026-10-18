'use client';

import { useRouter } from '@bprogress/next/app';
import type { Route } from 'next';
import { useHotkeys } from 'react-hotkeys-hook';

const codeBlockKeyOptions = {
  ignoreEventWhen: (event: KeyboardEvent) =>
    event.target instanceof Element &&
    Boolean(event.target.closest('figure.code-block')),
};

export function DocKeyboardShortcuts({
  previous,
  next,
}: {
  previous: Route | null;
  next: Route | null;
}) {
  const router = useRouter();

  const navigate = (href: Route | null) => {
    if (href) router.push(href);
  };

  useHotkeys(
    'ArrowRight',
    (event) => {
      // A native interaction was prevented on this event, someone else took ownership of it, ignore.
      if (event.defaultPrevented) return;

      navigate(next);
    },
    codeBlockKeyOptions
  );
  useHotkeys(
    'ArrowLeft',
    (event) => {
      // A native interaction was prevented on this event, someone else took ownership of it, ignore.
      if (event.defaultPrevented) return;

      navigate(previous);
    },
    codeBlockKeyOptions
  );

  return null;
}
