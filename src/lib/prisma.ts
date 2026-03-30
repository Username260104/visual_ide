import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DEFAULT_POOL_MAX = 1;
const DEFAULT_IDLE_TIMEOUT_MS = 5_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
type PgPoolInstance = {
  on: (event: 'error', listener: (error: Error) => void) => void;
};
type PgPoolConstructor = new (config: {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}) => PgPoolInstance;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as {
  Pool: PgPoolConstructor;
};

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
  prismaPool: PgPoolInstance | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(getPgPool() as never);
  return new PrismaClient({ adapter });
}

function getPgPool() {
  if (globalForPrisma.prismaPool) {
    return globalForPrisma.prismaPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const pool = new Pool({
    connectionString,
    max: parsePositiveInteger(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    idleTimeoutMillis: parsePositiveInteger(
      process.env.DATABASE_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS
    ),
    connectionTimeoutMillis: parsePositiveInteger(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS
    ),
    allowExitOnIdle: true,
  });

  pool.on('error', (error) => {
    console.error('Postgres pool error:', error);
  });

  globalForPrisma.prismaPool = pool;
  return pool;
}

function hasActivityEventDelegate(
  client: InstanceType<typeof PrismaClient> | undefined
): client is InstanceType<typeof PrismaClient> {
  return Boolean(client && 'activityEvent' in client);
}

export const prisma = hasActivityEventDelegate(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
