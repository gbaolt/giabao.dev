import type { Stack } from '#/types/stack';

export function isStart(stack: Stack): boolean {
  return stack.frontend === 'tanstack-start';
}

export function isAppsLayout(stack: Stack): boolean {
  return stack.structure === 'monorepo';
}

export function webPrefix(stack: Stack): string {
  if (isAppsLayout(stack)) {
    return 'apps/web/';
  }
  return '';
}

export function serverPrefix(stack: Stack): string {
  if (isAppsLayout(stack)) {
    return stack.backend === 'nest' || stack.backend === 'hono'
      ? 'apps/server/'
      : isStart(stack)
        ? 'apps/web/src/'
        : 'apps/web/';
  }
  return isStart(stack) ? 'src/' : '';
}

export function appDir(stack: Stack): string {
  if (isAppsLayout(stack)) {
    return isStart(stack) ? 'apps/web/src/routes' : 'apps/web/app';
  }
  return isStart(stack) ? 'src/routes' : 'app';
}

export function libDir(stack: Stack): string {
  if (isAppsLayout(stack)) {
    return isStart(stack) ? 'apps/web/src/lib' : 'apps/web/lib';
  }
  return isStart(stack) ? 'src/lib' : 'lib';
}

export function joinPath(prefix: string, rel: string): string {
  if (!prefix) {
    return rel;
  }
  return `${prefix.replace(/\/$/, '')}/${rel}`;
}
