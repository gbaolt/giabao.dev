'use client';

import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { MoonIcon } from '@/components/icons/moon';
import { SunIcon } from '@/components/icons/sun';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { META_THEME_COLORS } from '@/config/site';
import { useTheme } from '@/context/theme-provider';
import { useMetaColor } from '@/hooks/use-meta-color';
import { haptic } from '@/lib/haptic';
import { playSound } from '@/lib/soundcn/sound-engine';
import { switch006Sound } from '@/lib/soundcn/switch-006';

function playToggleSound() {
  void playSound(switch006Sound.dataUri, { volume: 0.3 }).catch(() => {});
}

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { setMetaColor } = useMetaColor();

  const switchTheme = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
    setMetaColor(
      resolvedTheme === 'dark'
        ? META_THEME_COLORS.light
        : META_THEME_COLORS.dark
    );
  }, [resolvedTheme, setTheme, setMetaColor]);

  const toggleTheme = useCallback(() => {
    playToggleSound();
    haptic();

    if (
      !document.startViewTransition ||
      window.matchMedia('(max-width: 640px)').matches
    ) {
      switchTheme();
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    const transition = document.startViewTransition(switchTheme);
    void transition.finished.finally(() => {
      root.classList.remove('theme-transitioning');
    });
  }, [switchTheme]);

  useHotkeys(
    'd',
    () => {
      playToggleSound();
      switchTheme();
    },
    { preventDefault: true }
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="active:scale-100"
          />
        }
      >
        <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          Toggle Mode
          <Kbd>D</Kbd>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
