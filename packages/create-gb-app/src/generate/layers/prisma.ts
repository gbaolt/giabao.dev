import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { joinPath } from '../layout';
import { manifestSections } from '../project-model';

export function emitPrisma(ctx: EmitCtx): void {
  // A server backend's database packages live in the server workspace.
  const pkg = manifestSections(ctx.project, ctx.layout.backendManifest!);
  pkg.dependencies['@prisma/client'] =
    DEPENDENCY_VERSIONS['@prisma/client'];
  pkg.devDependencies.prisma = DEPENDENCY_VERSIONS['prisma'];
  pkg.scripts['db:generate'] = 'prisma generate';
  const turso = ctx.stack.backend !== 'convex' && ctx.stack.dbSetup === 'turso';
  const direct =
    ctx.stack.backend !== 'convex' &&
    ctx.stack.database === 'postgres' &&
    (ctx.stack.dbSetup === 'planetscale' ||
      ctx.stack.dbSetup === 'prisma-postgres');
  if (turso) {
    pkg.dependencies['@prisma/adapter-libsql'] =
      DEPENDENCY_VERSIONS['@prisma/adapter-libsql'];
    pkg.scripts['db:migrate'] = 'prisma migrate dev';
  } else {
    pkg.scripts['db:push'] = 'prisma db push';
  }

  const dbPath = ctx.layout.dbFile;
  const schemaPath = joinPath(ctx.layout.envOwner, 'prisma/schema.prisma');
  const noteUser =
    ctx.stack.auth === 'none'
      ? ''
      : ctx.stack.auth === 'clerk'
        ? '\n  userId    String\n'
        : `
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
`;
  const noteIndex = ctx.stack.auth === 'none' ? '' : '\n  @@index([userId])';
  const authModels =
    ctx.stack.auth === 'better-auth'
      ? `
model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean
  image         String?
  createdAt     DateTime
  updatedAt     DateTime
  sessions      Session[]
  accounts      Account[]
  notes         Note[]

  @@unique([email])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([token])
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime
  updatedAt             DateTime

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@index([identifier])
  @@map("verification")
}
`
      : ctx.stack.auth === 'clerk'
        ? ''
        : '';

  const provider =
    ctx.stack.backend === 'convex'
      ? 'postgresql'
      : ctx.stack.backend === 'self' ||
          ctx.stack.backend === 'nest' ||
          ctx.stack.backend === 'hono'
        ? ctx.stack.database === 'mysql'
          ? 'mysql'
          : ctx.stack.database === 'sqlite'
            ? 'sqlite'
            : 'postgresql'
        : 'postgresql';

  setFile(
    ctx.files,
    dbPath,
    `import { PrismaClient } from '@prisma/client';
${
  turso
    ? `import { PrismaLibSQL } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSQL({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
`
    : ''
}
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient(${turso ? '{ adapter }' : ''});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`
  );

  setFile(
    ctx.files,
    schemaPath,
    `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("${turso ? 'LOCAL_DATABASE_URL' : 'DATABASE_URL'}")${direct ? '\n  directUrl = env("DIRECT_URL")' : ''}
}
${authModels}
model Note {
  id        String   @id @default(cuid())
  title     String
  body      String${noteUser}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt${noteIndex}
}
`
  );
}
