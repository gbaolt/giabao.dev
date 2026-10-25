import { expect, test } from 'bun:test';
import { YES_DEFAULTS } from 'create-gb-app/preset';

import { FLAG_OPTIONS, presentFlagOption } from './options';
test('self backend is Fullstack Next.js by default', () => {
  const option = FLAG_OPTIONS.core.backend.find(
    (item) => item.value === 'self'
  );
  expect(option).toBeDefined();
  if (!option) {
    return;
  }
  const presented = presentFlagOption(option, YES_DEFAULTS);
  expect(presented.label).toBe('Fullstack Next.js');
  expect(presented.description).toBe(
    'Next.js built-in API routes & server actions'
  );
});
test('self backend follows the selected frontend', () => {
  const option = FLAG_OPTIONS.core.backend.find(
    (item) => item.value === 'self'
  );
  expect(option).toBeDefined();
  if (!option) {
    return;
  }
  const presented = presentFlagOption(option, {
    ...YES_DEFAULTS,
    frontend: 'tanstack-start',
  });
  expect(presented.label).toBe('Fullstack TanStack Start');
  expect(presented.description).toBe(
    'TanStack Start built-in API routes & server functions'
  );
  expect(presented.value).toBe('self');
});
