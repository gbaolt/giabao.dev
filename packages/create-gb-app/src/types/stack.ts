import type {
  APIS,
  AUTHS,
  BACKENDS,
  DATABASES,
  DB_SETUPS,
  FORMS,
  FRONTENDS,
  LINTERS,
  LINTING,
  ORMS,
  PAYMENTS,
  PROJECT_STRUCTURES,
  TASK_RUNNERS,
} from '#/stack/vocab';

export type Frontend = (typeof FRONTENDS)[number];
export type Backend = (typeof BACKENDS)[number];
export type ProjectStructure = (typeof PROJECT_STRUCTURES)[number];
export type Api = (typeof APIS)[number];
export type Database = (typeof DATABASES)[number];
export type Orm = (typeof ORMS)[number];
export type DbSetup = (typeof DB_SETUPS)[number];
export type Auth = (typeof AUTHS)[number];
export type Payments = (typeof PAYMENTS)[number];
export type Linter = (typeof LINTERS)[number];
export type Form = (typeof FORMS)[number];
export type Addons = {
  toolchain: 'standard';
  taskRunner: (typeof TASK_RUNNERS)[number];
  linting: (typeof LINTING)[number];
  form: Form;
};
export type CoreFields = {
  frontend: Frontend;
  backend: Backend;
  structure: ProjectStructure;
  api: Api;
  database: Database;
  orm: Orm;
  dbSetup: DbSetup;
  auth: Auth;
  payments: Payments;
};
export type PresetFields = CoreFields & { addons: Addons };
export type SelectionValues = CoreFields & Addons;
export type RawFlags = Partial<Omit<CoreFields, 'structure'>> & {
  structure?: ProjectStructure | 'turborepo';
  addons?: Partial<Addons>;
  linter?: Linter;
  form?: Form;
  help?: boolean;
  version?: boolean;
  yes?: boolean;
  preset?: string;
  noGit?: boolean;
  noInstall?: boolean;
  projectName?: string;
};
type Shared = {
  frontend: Frontend;
  auth: Auth;
  payments: Payments;
  addons: Omit<Addons, 'linting' | 'taskRunner'> & {
    linting: Linter;
    taskRunner: 'none' | 'turborepo';
  };
};
type Relational = { database: Database; orm: Orm; dbSetup: DbSetup };
export type SelfStack = Shared &
  Relational & { backend: 'self'; api: Api; structure: ProjectStructure };
export type NestStack = Shared &
  Relational & { backend: 'nest'; api: Api; structure: 'monorepo' };
export type HonoStack = Shared &
  Relational & { backend: 'hono'; api: Api; structure: 'monorepo' };
export type ConvexStack = Shared & {
  backend: 'convex';
  structure: ProjectStructure;
};
export type Stack = SelfStack | NestStack | HonoStack | ConvexStack;
