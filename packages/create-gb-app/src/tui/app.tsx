import { CliRenderEvents, type ScrollBoxRenderable } from '@opentui/core';
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { formatCommand } from '#/preview/command';
import { previewTree } from '#/preview/tree';
import { canonicalRaw, parseChoice } from '#/stack/configuration';
import { CompatError } from '#/stack/errors';
import {
  databaseSetupRule,
  defaultStructureForBackend,
  resolveStack,
} from '#/stack/resolve';
import { DATABASES, DB_SETUPS, LINTING,ORMS, TASK_RUNNERS } from '#/stack/vocab';
import type {
  Api,
  Auth,
  Backend,
  Database,
  DbSetup,
  Form,
  Frontend,
  Orm,
  Payments,
  ProjectStructure,
  RawFlags,
} from '#/types/stack';

type FocusId =
  | 'backend'
  | 'structure'
  | 'frontend'
  | 'database'
  | 'orm'
  | 'dbSetup'
  | 'api'
  | 'auth'
  | 'payments'
  | 'taskRunner'
  | 'linting'
  | 'form'
  | 'confirm';

const FOCUS_ORDER: FocusId[] = [
  'backend',
  'structure',
  'frontend',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
  'taskRunner',
  'linting',
  'form',
  'confirm',
];

const BACKEND_OPTIONS = [
  { name: 'Self', description: 'API in the same app', value: 'self' },
  {
    name: 'Nest',
    description: 'apps/web, apps/server, packages/contract',
    value: 'nest',
  },
  { name: 'Convex', description: 'convex/ directory', value: 'convex' },
  {
    name: 'Hono',
    description: 'apps/web, apps/server, @hono/node-server',
    value: 'hono',
  },
];

const FRONTEND_OPTIONS = [
  { name: 'Next', description: 'Next.js App Router', value: 'next' },
  { name: 'Start', description: 'TanStack Start', value: 'tanstack-start' },
];

const OPTIONAL_STRUCTURE_OPTIONS = [
  {
    name: 'Single app',
    description: 'One app at project root',
    value: 'single',
  },
  {
    name: 'Monorepo',
    description: 'Web app with shared packages',
    value: 'monorepo',
  },
];
const REQUIRED_STRUCTURE_OPTIONS = [
  {
    name: 'Monorepo',
    description: 'Multiple applications and shared packages',
    value: 'monorepo',
  },
];

const API_OPTIONS = [
  { name: 'oRPC', description: 'Router-first procedures', value: 'orpc' },
  { name: 'tRPC', description: 'Router type from this app', value: 'trpc' },
  { name: 'None', description: 'No RPC layer', value: 'none' },
];

const AUTH_OPTIONS = [
  {
    name: 'Better Auth',
    description: 'Email and password',
    value: 'better-auth',
  },
  { name: 'Clerk', description: 'Hosted auth', value: 'clerk' },
  { name: 'None', description: 'Public notes', value: 'none' },
];
const FORM_OPTIONS = [
  { name: 'None', description: 'No form library', value: 'none' },
  {
    name: 'React Hook Form',
    description: 'Typed controllers and Zod',
    value: 'react-hook-form',
  },
  {
    name: 'TanStack Form',
    description: 'Typed form hooks and Zod',
    value: 'tanstack-form',
  },
];

function paymentOptions(auth: Auth | undefined) {
  const none = { name: 'None', description: 'No billing', value: 'none' };
  if (auth === 'none' || auth === undefined) {
    return [none];
  }
  const stripe = {
    name: 'Stripe',
    description: 'Checkout and portal',
    value: 'stripe',
  };
  if (auth === 'clerk') {
    return [none, stripe];
  }
  return [
    none,
    stripe,
    { name: 'Polar', description: 'Requires Better Auth', value: 'polar' },
  ];
}

function indexOfValue(
  options: Array<{ value: string }>,
  value: string | undefined,
  fallback = 0
) {
  const index = options.findIndex((option) => option.value === value);
  return index >= 0 ? index : fallback;
}

function nextFocus(current: FocusId, backend: Backend | undefined): FocusId {
  const order =
    backend === 'convex'
      ? FOCUS_ORDER.filter(
          (id) => !['api', 'database', 'orm', 'dbSetup'].includes(id)
        )
      : FOCUS_ORDER;
  const index = order.indexOf(current);
  return order[(index < 0 ? 0 : index + 1) % order.length];
}

export type AppProps = {
  initialFlags?: RawFlags;
  onExit?: () => void;
  onGenerate?: (flags: RawFlags) => void | Promise<void>;
};

function wizardFlags(input: RawFlags): RawFlags {
  const initialFlags = canonicalRaw(input);
  const backend = initialFlags.backend ?? 'self';
  const flags: RawFlags = {
    ...initialFlags,
    frontend: initialFlags.frontend ?? 'next',
    backend,
    structure: initialFlags.structure ?? defaultStructureForBackend(backend),
    auth: initialFlags.auth ?? 'better-auth',
    payments: initialFlags.payments ?? 'none',
    addons: {
      toolchain: 'standard',
      linting: 'auto',
      form: 'none',
      taskRunner:
        'auto',
      ...initialFlags.addons,
    },
    projectName: initialFlags.projectName ?? 'my-gb-app',
  };
  if (backend === 'convex') {
    flags.api = undefined;
    flags.database = undefined;
    flags.orm = undefined;
    if (flags.dbSetup !== 'none') {
      flags.dbSetup = undefined;
    }
  } else if (flags.api === undefined) {
    flags.api = 'orpc';
  }
  if (backend === 'nest' && flags.api === 'trpc') {
    flags.api = 'orpc';
  }
  return flags;
}

export function App({ initialFlags = {}, onExit, onGenerate }: AppProps) {
  const { width, height } = useTerminalDimensions();
  const renderer = useRenderer();
  const stacked = width < 72;
  const [flags, setFlags] = useState<RawFlags>(() => wizardFlags(initialFlags));
  const [focus, setFocus] = useState<FocusId>('backend');
  const controls = useRef<ScrollBoxRenderable>(null);

  const revealFocusedControl = useCallback(() => {
    controls.current?.scrollChildIntoView(`label-${focus}`);
    controls.current?.scrollChildIntoView(`control-${focus}`);
  }, [focus]);

  useLayoutEffect(() => {
    revealFocusedControl();
    // Resizes apply native geometry after React's layout effect.
    renderer.once(CliRenderEvents.FRAME, revealFocusedControl);
    return () => {
      renderer.off(CliRenderEvents.FRAME, revealFocusedControl);
    };
  }, [renderer, revealFocusedControl, width, height, flags.backend]);

  const payments = paymentOptions(flags.auth);
  const polarAvailable = flags.auth === 'better-auth';

  const resolved = useMemo(() => {
    try {
      return { stack: resolveStack(flags), error: null };
    } catch (error) {
      const message =
        error instanceof CompatError ? error.message : String(error);
      return { stack: null, error: message };
    }
  }, [flags]);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onExit?.();
      return;
    }
    if (key.name === 'tab') {
      setFocus((current: FocusId) => nextFocus(current, flags.backend));
    }
  });

  function patch(next: Partial<RawFlags>) {
    setFlags((current: RawFlags) => {
      const merged = {
        ...current,
        ...next,
        addons: { ...current.addons, ...next.addons },
      };
      if (next.backend !== undefined) {
        merged.structure = defaultStructureForBackend(next.backend);
        merged.addons.taskRunner =
          merged.structure === 'single' ? 'auto' : (current.addons?.taskRunner ?? 'auto');
      }
      if (next.structure !== undefined)
        merged.addons.taskRunner =
          next.structure === 'single' ? 'auto' : (current.addons?.taskRunner ?? 'auto');
      if (merged.backend === 'convex') {
        merged.api = undefined;
        merged.database = undefined;
        merged.orm = undefined;
        merged.dbSetup = undefined;
      }
      if (merged.backend === 'nest' && merged.api === 'trpc') {
        merged.api = 'orpc';
      }
      if (next.database !== undefined) {
        if (databaseSetupRule(next.database, merged.dbSetup ?? 'none'))
          merged.dbSetup = 'none';
        if (next.database === 'none') {
          merged.orm = 'none';
          if (merged.auth === 'better-auth') merged.auth = 'none';
        } else if (merged.orm === 'none') merged.orm = 'prisma';
      }
      if (merged.auth === 'none') {
        merged.payments = 'none';
      }
      if (merged.auth === 'clerk' && merged.payments === 'polar') {
        merged.payments = 'none';
      }
      return merged;
    });
  }

  const tree = resolved.stack
    ? previewTree(resolved.stack)
    : (resolved.error ?? '');
  const command = formatCommand(flags);
  const convexHidesApi = flags.backend === 'convex';
  const structureOptions =
    flags.backend === 'nest' || flags.backend === 'hono'
      ? REQUIRED_STRUCTURE_OPTIONS
      : OPTIONAL_STRUCTURE_OPTIONS;

  return (
    <box
      height={height}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      <scrollbox height={2} flexShrink={0} scrollX={false}>
        <text flexShrink={0}>{command}</text>
      </scrollbox>
      <box flexDirection="row" gap={1} flexGrow={1} minHeight={0}>
        <scrollbox
          ref={controls}
          width={stacked ? '100%' : 28}
          flexGrow={1}
          minHeight={0}
          scrollX={false}
          onSizeChange={revealFocusedControl}
          contentOptions={{ flexDirection: 'column', flexShrink: 0 }}
        >
          <text id="label-backend" flexShrink={0}>
            Backend
          </text>
          <select
            id="control-backend"
            flexShrink={0}
            focused={focus === 'backend'}
            height={4}
            showDescription={false}
            options={BACKEND_OPTIONS}
            selectedIndex={indexOfValue(BACKEND_OPTIONS, flags.backend)}
            onChange={(_index, option) => {
              if (option?.value) {
                patch({ backend: option.value as Backend });
              }
            }}
          />
          <text id="label-structure" flexShrink={0}>
            Project structure
          </text>
          <select
            id="control-structure"
            flexShrink={0}
            focused={focus === 'structure'}
            height={2}
            showDescription={false}
            options={structureOptions}
            selectedIndex={indexOfValue(structureOptions, flags.structure)}
            onChange={(_index, option) => {
              if (option?.value) {
                patch({ structure: option.value as ProjectStructure });
              }
            }}
          />
          <text flexShrink={0}>
            {flags.backend === 'nest' || flags.backend === 'hono'
              ? 'Nest/Hono need a monorepo'
              : 'Single app or monorepo'}
          </text>
          <text id="label-frontend" flexShrink={0}>
            Frontend
          </text>
          <select
            id="control-frontend"
            flexShrink={0}
            focused={focus === 'frontend'}
            height={2}
            showDescription={false}
            options={FRONTEND_OPTIONS}
            selectedIndex={indexOfValue(FRONTEND_OPTIONS, flags.frontend)}
            onChange={(_index, option) => {
              if (option?.value) {
                patch({ frontend: option.value as Frontend });
              }
            }}
          />
          {flags.backend === 'convex' ? null : (
            <box flexDirection="column" flexShrink={0}>
              <text id="label-api" flexShrink={0}>
                API
              </text>
              <select
                id="control-api"
                flexShrink={0}
                focused={focus === 'api'}
                height={flags.backend === 'nest' ? 2 : 3}
                showDescription={false}
                options={
                  flags.backend === 'nest'
                    ? API_OPTIONS.filter((option) => option.value !== 'trpc')
                    : API_OPTIONS
                }
                selectedIndex={indexOfValue(API_OPTIONS, flags.api)}
                onChange={(_index, option) => {
                  if (option?.value) {
                    patch({ api: option.value as Api });
                  }
                }}
              />
            </box>
          )}
          {flags.backend !== 'convex' && (
            <box flexDirection="column" flexShrink={0}>
              <text id="label-database" flexShrink={0}>
                Database
              </text>
              <select
                id="control-database"
                flexShrink={0}
                focused={focus === 'database'}
                height={4}
                showDescription={false}
                options={DATABASES.map((value) => ({
                  name: value,
                  description: value,
                  value,
                }))}
                selectedIndex={indexOfValue(
                  DATABASES.map((value) => ({ value })),
                  flags.database ?? 'postgres'
                )}
                onChange={(_index, option) => {
                  if (option?.value)
                    patch({ database: option.value as Database });
                }}
              />
              <text id="label-orm" flexShrink={0}>
                ORM
              </text>
              <select
                id="control-orm"
                flexShrink={0}
                focused={focus === 'orm'}
                height={2}
                showDescription={false}
                options={ORMS.filter((value) =>
                  (flags.database ?? 'postgres') === 'none'
                    ? value === 'none'
                    : value !== 'none'
                ).map((value) => ({ name: value, description: value, value }))}
                selectedIndex={(flags.orm ?? 'prisma') === 'drizzle' ? 1 : 0}
                onChange={(_index, option) => {
                  if (option?.value) patch({ orm: option.value as Orm });
                }}
              />
              <text id="label-dbSetup" flexShrink={0}>
                Database setup
              </text>
              <select
                id="control-dbSetup"
                flexShrink={0}
                focused={focus === 'dbSetup'}
                height={4}
                showDescription={false}
                options={DB_SETUPS.filter(
                  (value) =>
                    !databaseSetupRule(flags.database ?? 'postgres', value)
                ).map((value) => ({ name: value, description: value, value }))}
                selectedIndex={indexOfValue(
                  DB_SETUPS.filter(
                    (value) =>
                      !databaseSetupRule(flags.database ?? 'postgres', value)
                  ).map((value) => ({ value })),
                  flags.dbSetup ?? 'none'
                )}
                onChange={(_index, option) => {
                  if (option?.value)
                    patch({ dbSetup: option.value as DbSetup });
                }}
              />
            </box>
          )}
          <text id="label-auth" flexShrink={0}>
            Auth
          </text>
          <select
            id="control-auth"
            flexShrink={0}
            focused={focus === 'auth'}
            height={3}
            showDescription={false}
            options={AUTH_OPTIONS}
            selectedIndex={indexOfValue(AUTH_OPTIONS, flags.auth)}
            onChange={(_index, option) => {
              if (option?.value) {
                patch({ auth: option.value as Auth });
              }
            }}
          />
          <text id="label-payments" flexShrink={0}>
            Payments
          </text>
          <select
            id="control-payments"
            flexShrink={0}
            focused={focus === 'payments'}
            height={3}
            showDescription={false}
            options={payments}
            selectedIndex={indexOfValue(payments, flags.payments)}
            onChange={(_index, option) => {
              if (option?.value) {
                patch({ payments: option.value as Payments });
              }
            }}
          />
          <text flexShrink={0}>Addons / Development tools: Standard</text>
          {(['taskRunner', 'linting'] as const).map((group) => {
            const values =
              group === 'taskRunner'
                ? TASK_RUNNERS
                : LINTING;
            const options = values.map((value) => ({
              name:
                value === 'auto'
                  ? group === 'taskRunner'
                    ? 'Auto (no runner)'
                    : 'Auto (ESLint)'
                  : value,
              description: value,
              value,
            }));
            return (
              <box key={group} flexDirection="column" flexShrink={0}>
                <text id={`label-${group}`}>
                  {group === 'taskRunner' ? 'Task runner' : 'Linting'}
                </text>
                <select
                  id={`control-${group}`}
                  height={values.length}
                  showDescription={false}
                  options={options}
                  focused={focus === group}
                  selectedIndex={indexOfValue(options, flags.addons?.[group])}
                  onChange={(_index, option) => {
                    if (option?.value) {
                      if (group === 'taskRunner') patch({ addons: { taskRunner: parseChoice(group, option.value, TASK_RUNNERS) } });
                      else patch({ addons: { linting: parseChoice(group, option.value, LINTING) } });
                    }
                  }}
                />
              </box>
            );
          })}
          <text id="label-form" flexShrink={0}>
            Add-ons: Forms
          </text>
          <select
            id="control-form"
            flexShrink={0}
            focused={focus === 'form'}
            height={3}
            showDescription={false}
            options={FORM_OPTIONS}
            selectedIndex={indexOfValue(FORM_OPTIONS, flags.addons?.form)}
            onChange={(_index, option) => {
              if (option?.value)
                patch({ addons: { form: option.value as Form } });
            }}
          />
          <select
            id="control-confirm"
            flexShrink={0}
            focused={focus === 'confirm'}
            height={1}
            showDescription={false}
            options={[
              { name: 'Generate', description: 'Write files', value: 'go' },
            ]}
            onSelect={() => {
              void onGenerate?.(flags);
            }}
          />
        </scrollbox>
        {!stacked && (
          <scrollbox
            flexDirection="column"
            flexGrow={1}
            minHeight={0}
            border
            scrollX={false}
          >
            <text>Tree</text>
            <text>{tree}</text>
            <text>Command</text>
            <text>{command}</text>
            <text>
              {polarAvailable ? 'Polar available' : 'Polar unavailable'}
            </text>
            <text>
              {convexHidesApi ? 'API and database hidden' : 'API visible'}
            </text>
          </scrollbox>
        )}
      </box>
      {stacked && (
        <text flexShrink={0} truncate>
          Tree: {tree.replaceAll('\n', ', ')}
        </text>
      )}
      {stacked && (
        <text flexShrink={0}>
          {polarAvailable ? 'Polar available' : 'Polar unavailable'};{' '}
          {convexHidesApi ? 'API and database hidden' : 'API visible'}
        </text>
      )}
      <text flexShrink={0}>
        {stacked
          ? 'Tab: next. Esc: exit. Enter: generate.'
          : 'Tab cycles. Escape exits. Enter on Generate writes files.'}
      </text>
    </box>
  );
}
