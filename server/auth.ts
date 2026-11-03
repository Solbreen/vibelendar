import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db.js';
import { ApiError } from './errors.js';
import { accountIndex, fixedUsers } from './accounts.js';
import { parseOrThrow } from './validate.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function currentUserId(db: Db, request: FastifyRequest): number {
  const token = /(?:^|;\s*)vacation_session=([a-f0-9]+)/.exec(request.headers.cookie ?? '')?.[1] ?? '';
  const row = db.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hash(token), Date.now()) as { user_id: number } | undefined;
  if (!row || !fixedUsers(db).some((user) => user.id === row.user_id)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Введите пароль для входа');
  }
  return row.user_id;
}

export function registerAuth(app: FastifyInstance, db: Db): void {
  const attempts = new Map<string, { count: number; until: number }>();
  const cookie = (value: string, age: number) => `vacation_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
  app.post('/api/login', async (request, reply) => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const entry = attempts.get(request.ip) ?? { count: 0, until: now + 60_000 };
    if (entry.count >= 20) return reply.header('retry-after', Math.ceil((entry.until - now) / 1000)).status(429).send({ error: { code: 'UNAUTHORIZED', message: 'Слишком много попыток входа. Попробуйте через минуту.' } });
    entry.count += 1;
    attempts.set(request.ip, entry);
    const { password } = parseOrThrow(z.object({ password: z.string().min(1).max(200) }), request.body);
    const index = accountIndex(password);
    if (index < 0) throw new ApiError(401, 'UNAUTHORIZED', 'Неверный пароль');
    attempts.delete(request.ip);
    const user = fixedUsers(db)[index]!;
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hash(token), user.id, Date.now() + 30 * 86400_000);
    reply.header('set-cookie', cookie(token, 30 * 86400));
    return { user };
  });
  app.get('/api/me', async (request) => {
    const id = currentUserId(db, request);
    return { user: fixedUsers(db).find((user) => user.id === id)! };
  });
  app.post('/api/logout', async (request, reply) => {
    const token = /(?:^|;\s*)vacation_session=([a-f0-9]+)/.exec(request.headers.cookie ?? '')?.[1] ?? '';
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
    return reply.header('set-cookie', cookie('', 0)).status(204).send();
  });
}
