import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDb, type Db } from '../db.js';
import type { UserDto } from '../../shared/types.js';

export const YEAR = 2027;

export interface TestContext {
  app: FastifyInstance;
  db: Db;
}

/** Поднимает приложение на базе в памяти. */
export async function createTestApp(year = YEAR): Promise<TestContext> {
  const db = openDb(':memory:');
  const app = await buildApp({
    db,
    config: { port: 0, dbPath: ':memory:', vacationYear: year },
  });
  return { app, db };
}

export async function closeTestApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
  ctx.db.close();
}

/** Password login; session cookie is explicit in requests. */
export async function login(
  app: FastifyInstance,
  password: string,
): Promise<{ statusCode: number; user: UserDto; cookie: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { password },
  });
  const body = response.json() as { user: UserDto };
  return { statusCode: response.statusCode, ...body, cookie: String(response.headers['set-cookie']).split(';')[0]! };
}

export function errorOf(response: { json: () => unknown }): {
  code: string;
  message: string;
  user?: UserDto;
} {
  return (response.json() as { error: { code: string; message: string; user?: UserDto } }).error;
}
