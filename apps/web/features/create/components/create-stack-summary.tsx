'use client';

import { type FlagGroup, selectionValue } from 'create-gb-app/preset';
import { Layers3Icon } from 'lucide-react';

import {
  FLAG_GROUP_LABELS,
  optionsFor,
  presentFlagOption,
} from '../data/options';
import { useCreate } from './create-provider';

const SUMMARY_GROUPS: readonly FlagGroup[] = [
  'structure',
  'frontend',
  'backend',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
  'form',
  'linting',
  'taskRunner',
  'toolchain',
];

export function CreateStackSummary() {
  const { flags } = useCreate();
  const architecture =
    flags.structure === 'monorepo'
      ? 'Applications and shared packages in one workspace.'
      : 'One fullstack application at the project root.';
  const principalTools = (
    ['frontend', 'backend', 'api', 'database', 'orm', 'auth', 'form'] as const
  )
    .filter((group) => group !== 'backend' || flags.backend !== 'self')
    .filter((group) => selectionValue(flags, group) !== 'none')
    .map(
      (group) =>
        optionsFor(group).find(
          (option) => option.value === selectionValue(flags, group)
        )?.label
    )
    .filter(Boolean);

  return (
    <section
      aria-label="Project stack"
      className="relative flex min-h-0 flex-col border-b max-xl:hidden"
    >
      <div className="bg-background z-10 space-y-2 border-b p-3">
        <h2 className="text-sm/none font-medium">Project stack</h2>
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {architecture} Built with {principalTools.join(', ')}. Includes
          shadcn/ui, Base UI, and Zod.
        </p>
      </div>
      <ul className="relative h-full overflow-y-auto [--col-left-width:--spacing(14)]">
        {SUMMARY_GROUPS.map((group) => {
          if (selectionValue(flags, group) === 'none') return null;
          const selected = optionsFor(group).find(
            (option) => option.value === selectionValue(flags, group)
          );
          if (!selected) return null;
          const option = presentFlagOption(selected, flags);
          const Icon = option.icon ?? Layers3Icon;

          return (
            <div
              key={group}
              className="border-border flex items-center border-b last:border-b-0 last:border-none"
            >
              <div className="h-full border-r border-dashed p-3">
                <span className="bg-muted/50 my-auto flex size-8 shrink-0 items-center justify-center rounded-md border">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0 px-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {FLAG_GROUP_LABELS[group]}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {option.description}
                </p>
              </div>
            </div>
          );
        })}
      </ul>
    </section>
  );
}
