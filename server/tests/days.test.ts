import { afterEach, beforeEach, expect, it } from 'vitest';
import { closeTestApp, createTestApp, type TestContext } from './helpers.js';
import { fixedUsers } from '../accounts.js';
import { saveDays } from '../repo.js';
let ctx: TestContext;
let id: number;
let cookie: string;
const range = (start: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86400_000).toISOString().slice(0, 10));
beforeEach(async () => {
 ctx = await createTestApp();
 const r = await ctx.app.inject({ method: 'POST', url: '/api/login', payload: { password: 'dragomilovaa1' } });
 id = r.json().user.id; cookie = String(r.headers['set-cookie']).split(';')[0]!;
});
afterEach(async () => { await closeTestApp(ctx); });
const put = (dates: string[], version = 0) => ctx.app.inject({ method: 'PUT', url: `/api/users/${id}/days`, headers: { cookie }, payload: { dates, version } });
it('saves 28 days, deduplicates, increments version and replaces atomically', async () => {
 const dates = range('2027-07-01',28);
 const r = await put([...dates,...dates]);
 expect(r.statusCode).toBe(200); expect(r.json().user).toMatchObject({ days: dates, version: 1 });
 const replacement = range('2027-08-01',28);
 expect((await put(replacement,1)).json().user.days).toEqual(replacement);
});
it('rejects a stale version and preserves latest dates', async () => {
 await put(range('2027-07-01',28));
 const r = await put(range('2027-08-01',28));
 expect(r.statusCode).toBe(409); expect(r.json().error.user.version).toBe(1);
});
it('rejects fewer than 28 counted days, missing long period and holiday boundaries', async () => {
 for (const dates of [[], range('2027-06-01',28), [...range('2027-07-01',28),'2027-05-01'], [...range('2027-07-01',13),...range('2027-08-01',13),...range('2027-09-01',2)]]) {
 const r = await put(dates); expect(r.statusCode).toBe(400); expect(r.json().error.code).toBe('VACATION_RULES');
 }
 expect((await ctx.app.inject(`/api/users/${id}`)).json().user.version).toBe(0);
});
it('rejects invalid and wrong-year dates', async () => {
 for(const date of ['2027-02-30','2028-07-01','bad']) {
 const r = await put([...range('2027-07-01',28),date]); expect(r.statusCode).toBe(400); expect(r.json().error.code).toBe('INVALID_DATE');
 }
});
it('enforces conflicts server-side and leaves the rejected calendar unchanged', async () => {
 const people = fixedUsers(ctx.db);
 const diana = people[0]!, magomed = people[1]!;
 saveDays(ctx.db,diana.id,range('2027-07-01',28),0);
 const r = await ctx.app.inject({method:'POST',url:'/api/login',payload:{password:'barakhoevml'}});
 const headers = {cookie:String(r.headers['set-cookie']).split(';')[0]!};
 const rejected = await ctx.app.inject({method:'PUT',url:`/api/users/${magomed.id}/days`,headers,payload:{dates:range('2027-07-01',28),version:0}});
 expect(rejected.statusCode).toBe(400); expect(rejected.json().error.message).toContain('допустимое пересечение — 5');
 expect((await ctx.app.inject(`/api/users/${magomed.id}`)).json().user.days).toEqual([]);
});
