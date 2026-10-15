'use client';

import {
  configurationFromQuery,
  configurationQuery,
  type CreateFlags,
  FLAG_GROUPS,
  type FlagGroup,
  type SelectionValues,
  YES_DEFAULTS,
} from 'create-gb-app/preset';
import { parseAsString, useQueryStates } from 'nuqs';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
} from 'react';

import { Button } from '@/components/ui/button';

import { useProjectName } from '../hooks/use-project-name';
import { buildCommand } from '../lib/command';
import {
  applyFlagChange,
  isOptionEnabled,
  normalizeFlags,
} from '../lib/compat';

type CreateContextValue = {
  flags: CreateFlags;
  setFlag: <K extends FlagGroup>(key: K, value: SelectionValues[K]) => void;
  setFlags: (flags: CreateFlags) => void;
  projectName: string;
  previewProjectName: string;
  setProjectName: (name: string) => void;
  command: string;
};
const CreateContext = createContext<CreateContextValue | null>(null);
const searchKeys = [
  'schema',
  'linter',
  ...FLAG_GROUPS.map((key) =>
    key === 'dbSetup' ? 'db-setup' : key === 'taskRunner' ? 'task-runner' : key
  ),
];
const parsers = Object.fromEntries(
  searchKeys.map((key) => [key, parseAsString])
);

export function CreateProvider({ children }: { children: ReactNode }) {
  const [query, setParams] = useQueryStates(parsers, { history: 'replace' });
  let flags: CreateFlags = YES_DEFAULTS;
  let queryError: string | null = null;
  try {
    flags = normalizeFlags(configurationFromQuery(query));
  } catch (error) {
    queryError =
      error instanceof Error ? error.message : 'Invalid Configuration';
  }
  const { projectName, previewProjectName, setProjectName } = useProjectName();
  const setFlags = useCallback(
    (next: CreateFlags) => {
      void setParams({
        ...configurationQuery(normalizeFlags(next)),
        linter: null,
      });
    },
    [setParams]
  );
  useEffect(() => {
    if (
      !queryError &&
      (query.schema !== '2' ||
        query.linter !== null ||
        query.structure === 'turborepo')
    )
      setFlags(flags);
  }, [
    query.schema,
    query.linter,
    query.structure,
    setFlags,
    flags,
    queryError,
  ]);
  const setFlag = useCallback(
    <K extends FlagGroup>(key: K, value: SelectionValues[K]) => {
      void setParams((current) => {
        const configuration = normalizeFlags(configurationFromQuery(current));
        if (!isOptionEnabled(configuration, key, value)) return {};
        return {
          ...configurationQuery(applyFlagChange(configuration, key, value)),
          linter: null,
        };
      });
    },
    [setParams]
  );
  if (queryError)
    return (
      <div role="alert" className="space-y-3 p-4">
        <p>{queryError}</p>
        <Button onClick={() => setFlags(YES_DEFAULTS)}>
          Reset Configuration
        </Button>
      </div>
    );
  return (
    <CreateContext.Provider
      value={{
        flags,
        setFlag,
        setFlags,
        projectName,
        previewProjectName,
        setProjectName,
        command: buildCommand(flags, projectName),
      }}
    >
      {children}
    </CreateContext.Provider>
  );
}
export function useCreate(): CreateContextValue {
  const value = use(CreateContext);
  if (!value) throw new Error('useCreate must be used within CreateProvider');
  return value;
}
