import { afterEach, beforeEach, expect, it } from 'vitest';
import { fixedUsers } from '../accounts.js';
import { saveDays, getOrCreateUser } from '../repo.js';
import { closeTestApp, createTestApp, type TestContext } from './helpers.js';
let ctx: TestContext;
beforeEach(async () => { ctx = await createTestApp(); });
afterEach(async () => { await closeTestApp(ctx); });
it('starts with exactly ten empty calendars sorted by surname', async () => {
 const data = (await ctx.app.inject('/api/calendar')).json();
 expect(data.year).toBe(2027); expect(data.users).toHaveLength(10);
 expect(data.users.every((u: { days: string[]; dayCount: number }) => u.days.length === 0 && u.dayCount === 0)).toBe(true);
 const names = data.users.map((u: { lastName: string }) => u.lastName);
 expect(names).toEqual([...names].sort(new Intl.Collator('ru').compare));
});
it('everyone can read colleagues dates, and holidays are not counted', async () => {
 const user = fixedUsers(ctx.db)[0]!;
 saveDays(ctx.db, user.id, ['2027-05-08', '2027-05-09', '2027-05-10'], 0);
 const data = (await ctx.app.inject('/api/calendar')).json();
 expect(data.users.find((u: { id: number }) => u.id === user.id)).toMatchObject({ days: ['2027-05-08','2027-05-09','2027-05-10'], dayCount: 2 });
});
it('does not expose users outside the fixed roster', async () => {
 getOrCreateUser(ctx.db, 'Другой', 'Человек');
 expect((await ctx.app.inject('/api/calendar')).json().users).toHaveLength(10);
});
it('uses the configured vacation year', async () => {
 const other = await createTestApp(2030);
 try { expect((await other.app.inject('/api/calendar')).json().year).toBe(2030); }
 finally { await closeTestApp(other); }
});
