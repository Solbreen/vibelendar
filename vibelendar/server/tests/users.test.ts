import { afterEach, beforeEach, expect, it } from 'vitest';
import { accounts } from '../accounts.js';
import { closeTestApp, createTestApp, type TestContext } from './helpers.js';
let ctx: TestContext;
beforeEach(async () => { ctx = await createTestApp(); });
afterEach(async () => { await closeTestApp(ctx); });
it('health endpoint works', async () => expect((await ctx.app.inject('/api/health')).json()).toEqual({ ok: true }));
it.each(accounts)('password opens the fixed account %s %s', async (first, last, password) => {
 const r = await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password } });
 expect(r.statusCode).toBe(200);
 expect(r.json().user).toMatchObject({ firstName: first, lastName: last, days: [] });
});
it('old ID in browser cannot restore an authenticated session', async () => {
 expect((await ctx.app.inject('/api/me')).statusCode).toBe(401);
});
it('rejects malformed login bodies', async () => {
 for (const payload of [{}, { password: 123 }, { password: '' }]) {
 expect((await ctx.app.inject({ method: 'POST', url: '/api/login', payload })).statusCode).toBe(400);
 }
});
