import { CliRenderEvents, type ScrollBoxRenderable } from '@opentui/core';
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { formatCommand } from '#/preview/command';
import { previewTree } from '#/preview/tree';
import {
  canonicalRaw,
  parseChoice,
  selectionValue,
} from '#/stack/configuration';
import { configurationDefaults, resolveStack } from '#/stack/resolve';
import { applyChange, optionState, repairConfiguration } from '#/stack/rules';
import {
  DATABASES,
  DB_SETUPS,
  type FlagGroup,
  LINTING,
  ORMS,
  TASK_RUNNERS,
  VOCAB_BY_GROUP,
} from '#/stack/vocab';
import type { PresetFields, RawFlags } from '#/types/stack';

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

type Option = { name: string; description: string; value: string };

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

const STRUCTURE_OPTIONS = [
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
const PAYMENT_OPTIONS = [
  { name: 'None', description: 'No billing', value: 'none' },
  { name: 'Stripe', description: 'Checkout and portal', value: 'stripe' },
  { name: 'Polar', description: 'Requires Better Auth', value: 'polar' },
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

function plainOptions(values: readonly string[]): Option[] {
  return values.map((value) => ({ name: value, description: value, value }));
}

function selection(group: FlagGroup, value: string) {
  return parseChoice(group, value, VOCAB_BY_GROUP[group]);
}

function enabledOptions(
  configuration: PresetFields,
  group: FlagGroup,
  options: Option[]
): Option[] {
  return options.filter(
    (option) =>
      optionState(configuration, group, selection(group, option.value)).enabled
  );
}

function indexOfValue(
  options: Array<{ value: string }>,
  value: string | undefined,
  fallback = 0
) {
  const index = options.findIndex((option) => option.value === value);
  return index >= 0 ? index : fallback;
}

function nextFocus(
  current: FocusId,
  backend: PresetFields['backend']
): FocusId {
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

export function App({ initialFlags = {}, onExit, onGenerate }: AppProps) {
  const { width, height } = useTerminalDimensions();
  const renderer = useRenderer();
  const stacked = width < 72;
  const [configuration, setConfiguration] = useState(() =>
    repairConfiguration(configurationDefaults(initialFlags))
  );
  const [focus, setFocus] = useState<FocusId>('backend');
  const controls = useRef<ScrollBoxRenderable>(null);
  const flags: RawFlags = {
    ...canonicalRaw(initialFlags),
    projectName: initialFlags.projectName ?? 'my-gb-app',
    ...configuration,
  };

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
  }, [renderer, revealFocusedControl, width, height, configuration.backend]);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onExit?.();
      return;
    }
    if (key.name === 'tab') {
      setFocus((current: FocusId) => nextFocus(current, configuration.backend));
    }
  });

  function choose(group: FlagGroup, value: string | undefined) {
    if (!value) return;
    setConfiguration((current) =>
      applyChange(current, group, selection(group, value))
    );
  }

  function selectProps(group: FlagGroup, options: Option[]) {
    const enabled = enabledOptions(configuration, group, options);
    return {
      id: `control-${group}`,
      flexShrink: 0,
      focused: focus === group,
      showDescription: false,
      options: enabled,
      selectedIndex: indexOfValue(
        enabled,
        selectionValue(configuration, group)
      ),
      onChange: (_index: number, option: { value?: unknown } | null) => {
        choose(
          group,
          typeof option?.value === 'string' ? option.value : undefined
        );
      },
    };
  }

  const tree = previewTree(resolveStack(configuration));
  const command = formatCommand(flags);
  const polarAvailable = optionState(
    configuration,
    'payments',
    'polar'
  ).enabled;
  const convexHidesApi = configuration.backend === 'convex';
  const serverBackend =
    configuration.backend === 'nest' || configuration.backend === 'hono';

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
          <select height={4} {...selectProps('backend', BACKEND_OPTIONS)} />
          <text id="label-structure" flexShrink={0}>
            Project structure
          </text>
          <select height={2} {...selectProps('structure', STRUCTURE_OPTIONS)} />
          <text flexShrink={0}>
            {serverBackend
              ? 'Nest/Hono need a monorepo'
              : 'Single app or monorepo'}
          </text>
          <text id="label-frontend" flexShrink={0}>
            Frontend
          </text>
          <select height={2} {...selectProps('frontend', FRONTEND_OPTIONS)} />
          {convexHidesApi ? null : (
            <box flexDirection="column" flexShrink={0}>
              <text id="label-api" flexShrink={0}>
                API
              </text>
              <select height={3} {...selectProps('api', API_OPTIONS)} />
              <text id="label-database" flexShrink={0}>
                Database
              </text>
              <select
                height={4}
                {...selectProps('database', plainOptions(DATABASES))}
              />
              <text id="label-orm" flexShrink={0}>
                ORM
              </text>
              <select height={2} {...selectProps('orm', plainOptions(ORMS))} />
              <text id="label-dbSetup" flexShrink={0}>
                Database setup
              </text>
              <select
                height={4}
                {...selectProps('dbSetup', plainOptions(DB_SETUPS))}
              />
            </box>
          )}
          <text id="label-auth" flexShrink={0}>
            Auth
          </text>
          <select height={3} {...selectProps('auth', AUTH_OPTIONS)} />
          <text id="label-payments" flexShrink={0}>
            Payments
          </text>
          <select height={3} {...selectProps('payments', PAYMENT_OPTIONS)} />
          <text flexShrink={0}>Addons / Development tools: Standard</text>
          {(['taskRunner', 'linting'] as const).map((group) => {
            const values = group === 'taskRunner' ? TASK_RUNNERS : LINTING;
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
                  height={values.length}
                  {...selectProps(group, options)}
                />
              </box>
            );
          })}
          <text id="label-form" flexShrink={0}>
            Add-ons: Forms
          </text>
          <select height={3} {...selectProps('form', FORM_OPTIONS)} />
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
