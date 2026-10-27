import {
  applyChange,
  type CreateFlags,
  FLAG_GROUPS,
  optionState,
  selectionValue,
  VOCAB_BY_GROUP,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

function sameConfiguration(left: CreateFlags, right: CreateFlags): boolean {
  return FLAG_GROUPS.every(
    (group) => selectionValue(left, group) === selectionValue(right, group)
  );
}

export function shuffleConfiguration(
  current: CreateFlags,
  random: () => number = Math.random
): CreateFlags {
  for (let attempt = 0; attempt < 20; attempt++) {
    let next: CreateFlags = YES_DEFAULTS;

    for (const group of FLAG_GROUPS) {
      const choices = VOCAB_BY_GROUP[group].filter(
        (value) => optionState(next, group, value).enabled
      );
      const value = choices[Math.floor(random() * choices.length)];
      if (value !== undefined) {
        next = applyChange(next, group, value);
      }
    }

    if (!sameConfiguration(current, next)) {
      return next;
    }
  }

  return applyChange(
    current,
    'linting',
    current.addons.linting === 'eslint' ? 'oxlint' : 'eslint'
  );
}
