import { expect, test } from 'bun:test';
import {
  applyChange,
  optionState,
  repairConfiguration,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

test('Create enforces hosted engine constraints and clears hosts when prerequisites change', () => {
  expect(optionState(YES_DEFAULTS, 'dbSetup', 'turso')).toMatchObject({
    ruleId: 'turso-requires-sqlite',
  });
  expect(
    optionState(
      { ...YES_DEFAULTS, database: 'sqlite' },
      'dbSetup',
      'planetscale'
    )
  ).toMatchObject({ ruleId: 'planetscale-requires-postgres-or-mysql' });
  expect(
    optionState(
      { ...YES_DEFAULTS, database: 'mysql' },
      'dbSetup',
      'prisma-postgres'
    )
  ).toMatchObject({ ruleId: 'prisma-postgres-requires-postgres' });
  expect(
    applyChange(
      { ...YES_DEFAULTS, database: 'sqlite', dbSetup: 'turso' },
      'database',
      'postgres'
    ).dbSetup
  ).toBe('none');
  expect(
    repairConfiguration({
      ...YES_DEFAULTS,
      database: 'mysql',
      dbSetup: 'turso',
    }).dbSetup
  ).toBe('none');
});
