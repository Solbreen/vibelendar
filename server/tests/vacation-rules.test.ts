import { expect, it } from 'vitest';
import { accounts } from '../accounts.js';
import { overlapIssues } from '../vacation-rules.js';
const people = () => accounts.map(([firstName, lastName], id) => ({ id: id + 1, firstName, lastName, displayName: `${firstName} ${lastName}`, days: [] as string[], version: 0, color: '#000' }));
it.each([[0, 1, 5], [1, 6, 0], [0, 3, 0], [7, 8, 0]])('enforces the pair %i/%i in both directions', (a, b, limit) => {
  const users = people();
  const dates = Array.from({ length: limit + 1 }, (_, i) => `2027-07-0${i + 1}`);
  users[b]!.days = dates;
  expect(overlapIssues(users[a]!.id, dates, users)).toHaveLength(1);
  expect(overlapIssues(users[a]!.id, dates.slice(0, limit), users)).toEqual([]);
  users[a]!.days = dates;
  expect(overlapIssues(users[b]!.id, dates, users)).toHaveLength(1);
});
it('holidays never count as overlaps', () => {
  const users = people();
  for (const user of users) user.days = ['2027-01-01','2027-05-01','2027-05-09'];
  for (const user of users) expect(overlapIssues(user.id, user.days, users)).toEqual([]);
});
it('allows two of the three colleagues, rejects all three for every member', () => {
  const users = people();
  const ids = [5, 4, 9];
  users[4]!.days = ['2027-07-01'];
  expect(overlapIssues(users[5]!.id, ['2027-07-01'], users)).toEqual([]);
  for (const index of ids) users[index]!.days = ['2027-07-01'];
  for (const index of ids) expect(overlapIssues(users[index]!.id, ['2027-07-01'], users)).toHaveLength(1);
});
it('unrelated people may overlap', () => {
  const users = people();
  for (const user of users) user.days = ['2027-07-01'];
  expect(overlapIssues(users[2]!.id, ['2027-07-01'], users)).toEqual([]);
});
