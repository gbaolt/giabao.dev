'use client';

import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useCommandMenu } from '@/context/command-menu-provider';
import { haptic } from '@/lib/haptic';
import { clickSoftSound } from '@/lib/soundcn/click-soft';
import { playSound } from '@/lib/soundcn/sound-engine';
import type { DocPreview } from '@/types/document';

const LazyCommandMenuDialog = dynamic(
  () => import('./command-menu-dialog').then((mod) => mod.CommandMenuDialog),
  { ssr: false }
);

function playTriggerSound() {
  void playSound(clickSoftSound.dataUri, { volume: 0.3 }).catch(() => {});
}

export function CommandMenuDialog({ blogs }: { blogs: DocPreview[] }) {
  const { open, setOpen } = useCommandMenu();
  const [hasOpened, setHasOpened] = React.useState(false);

  useHotkeys(
    'mod+k',
    () => {
      playTriggerSound();
      setOpen((current) => !current);
    },
    { preventDefault: true, enableOnFormTags: true }
  );
  useHotkeys('escape', () => setOpen(false), {
    enabled: open,
    enableOnFormTags: true,
  });

  if (open && !hasOpened) setHasOpened(true);

  return hasOpened ? <LazyCommandMenuDialog blogs={blogs} /> : null;
}

export function CommandMenu() {
  const { setOpen } = useCommandMenu();

  const handleOpen = React.useCallback(() => {
    playTriggerSound();
    setOpen(true);
    haptic();
  }, [setOpen]);

  return <CommandMenuTrigger onClick={handleOpen} />;
}

function CommandMenuTrigger({ ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="command-menu-trigger"
      aria-label="Open command menu"
      className="group text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30 rounded-full shadow-none select-none active:scale-100"
      variant="outline"
      size="sm"
      {...props}
    >
      <Search data-icon="inline-start" className="size-5 sm:size-4 md:mr-1" />
      <span className="font-sans text-sm/4 font-medium sm:hidden">Search…</span>
      <KbdGroup className="hidden sm:in-[.os-macos_&]:flex">
        <Kbd className="group-active:text-foreground w-5 min-w-5">⌘</Kbd>
        <Kbd className="group-active:text-foreground w-5 min-w-5">K</Kbd>
      </KbdGroup>
      <KbdGroup className="hidden sm:not-[.os-macos_&]:flex">
        <Kbd className="group-active:text-foreground min-w-5">Ctrl</Kbd>
        <Kbd className="group-active:text-foreground w-5 min-w-5">K</Kbd>
      </KbdGroup>
    </Button>
  );
}
