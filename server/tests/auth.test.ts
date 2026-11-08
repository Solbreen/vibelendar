import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTestApp, closeTestApp, type TestContext } from './helpers.js';
let ctx: TestContext;
it('supports login and calendar under the application prefix', async () => {
  const context = await createTestApp();
  try {
    const calendar = await context.app.inject('/vibelendar/api/calendar');
    expect(calendar.statusCode).toBe(200);
    expect(calendar.json().users).toHaveLength(10);
    const login = await context.app.inject({ method: 'POST', url: '/vibelendar/api/login', payload: { password: 'kuprinadn' } });
    expect(login.statusCode).toBe(200);
  } finally { await closeTestApp(context); }
});
beforeEach(async () => { ctx = await createTestApp(); });
afterEach(async () => { await closeTestApp(ctx); });

it('shows exactly ten fixed people and never exposes passwords', async () => {
  const response = await ctx.app.inject('/api/calendar');
  expect(response.json().users).toHaveLength(10);
  expect(response.body).not.toContain('kuprinadn');
});
it('requires a valid password, restores session, and invalidates logout', async () => {
  expect((await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'wrong' } })).statusCode).toBe(401);
  const login = await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'kuprinadn' } });
  expect(login.statusCode).toBe(200);
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  expect(cookie).toContain('vacation_session=');
  const me = await ctx.app.inject({ url: '/api/me', headers: { cookie } });
  expect(me.json().user.displayName).toBe('Диана Куприна');
  await ctx.app.inject({ method: 'POST', url: '/api/logout', headers: { cookie } });
  expect((await ctx.app.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
});
it('rejects expired sessions', async () => {
  const login = await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'kuprinadn' } });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  ctx.db.prepare('UPDATE sessions SET expires_at = 0').run();
  expect((await ctx.app.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
});
it('limits incorrect password attempts', async () => {
  for (let i = 0; i < 20; i++) await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'wrong' } });
  expect((await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'wrong' } })).statusCode).toBe(429);
});
it('rejects unauthenticated writes, other peoples dates, registration, rename and deletion', async () => {
  const people = (await ctx.app.inject('/api/calendar')).json().users;
  const id = people.find((user: { lastName: string }) => user.lastName === 'Куприна').id;
  expect((await ctx.app.inject({ method: 'PUT', url: `/api/users/${id}/days`, payload: { dates: [], version: 0 } })).statusCode).toBe(401);
  const login = await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'gritsvv' } });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  expect((await ctx.app.inject({ method: 'PUT', url: `/api/users/${id}/days`, headers: { cookie }, payload: { dates: [], version: 0 } })).statusCode).toBe(403);
  for (const method of ['PATCH', 'DELETE'] as const) expect((await ctx.app.inject({ method, url: `/api/users/${id}`, headers: { cookie } })).statusCode).toBe(404);
  expect((await ctx.app.inject({ method: 'POST', url: '/api/users', payload: { firstName: 'Новый', lastName: 'Человек' } })).statusCode).toBe(404);
});
