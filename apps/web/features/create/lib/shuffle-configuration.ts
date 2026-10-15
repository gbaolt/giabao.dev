import {
  type CreateFlags,
  FLAG_GROUPS,
  selectionValue,
  VOCAB_BY_GROUP,
  withSelection,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

import { applyFlagChange, isOptionEnabled, normalizeFlags } from './compat';

function sameConfiguration(left: CreateFlags, right: CreateFlags): boolean {
  return FLAG_GROUPS.every(
    (group) => selectionValue(left, group) === selectionValue(right, group)
  );
}

function canGenerate(flags: CreateFlags): boolean {
  return (
    flags.addons.linting !== 'biome' &&
    !(
      flags.frontend === 'tanstack-start' &&
      flags.backend === 'self' &&
      flags.api === 'orpc'
    )
  );
}

export function shuffleConfiguration(
  current: CreateFlags,
  random: () => number = Math.random
): CreateFlags {
  for (let attempt = 0; attempt < 20; attempt++) {
    let next: CreateFlags = { ...YES_DEFAULTS };

    for (const group of FLAG_GROUPS) {
      const choices = VOCAB_BY_GROUP[group].filter((value) =>
        isOptionEnabled(next, group, value)
      );
      const value = choices[Math.floor(random() * choices.length)];
      if (value !== undefined) {
        next = applyFlagChange(next, group, value);
      }
    }

    next = normalizeFlags(next);
    if (canGenerate(next) && !sameConfiguration(current, next)) {
      return next;
    }
  }

  return normalizeFlags(
    withSelection(
      current,
      'linting',
      current.addons.linting === 'eslint' ? 'oxlint' : 'eslint'
    )
  );
}
