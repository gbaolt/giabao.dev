import { expect, test } from 'bun:test';
import { buildTree, resolveStack } from 'create-gb-app/generate';
import {
  FLAG_GROUPS,
  repairConfiguration,
  selectionValue,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

import { shuffleConfiguration } from '../shuffle-configuration';
test('shuffle produces distinct configurations accepted by the generator', () => {
  let seed = 19;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let previous = repairConfiguration(YES_DEFAULTS);
  for (let index = 0; index < 100; index++) {
    const next = shuffleConfiguration(previous, random);
    expect(
      FLAG_GROUPS.some(
        (group) =>
          selectionValue(next, group) !== selectionValue(previous, group)
      )
    ).toBe(true);
    expect(() =>
      buildTree(resolveStack(next), {
        projectName: 'shuffle-test',
        packageManager: 'bun',
      })
    ).not.toThrow();
    previous = next;
  }
});
