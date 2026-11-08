import { expect, it } from 'vitest';
import { vacationIssues } from './vacation-rules.js';
const range = (start: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86400_000).toISOString().slice(0, 10));
it('accepts exactly 28 ordinary days, including weekends', () => expect(vacationIssues(range('2027-07-01', 28))).toEqual([]));
it('does not count a holiday toward the minimum', () => expect(vacationIssues(range('2027-06-01', 28)).join(' ')).toContain('27 из необходимых 28'));
it('requires 14 counted days within one selected continuous period', () => {
  const dates = [...range('2027-04-28', 15), ...range('2027-07-01', 13), ...range('2027-08-01', 2)];
  expect(vacationIssues(dates).join(' ')).toContain('Самый длинный выбранный период — 13');
  expect(vacationIssues([...dates, '2027-05-13'])).toEqual([]);
});
it('an unselected holiday interrupts a period', () => {
  const dates = [...range('2027-04-28', 16).filter((date) => date !== '2027-05-01'), ...range('2027-07-01', 13), ...range('2027-08-01', 4)];
  expect(vacationIssues(dates).join(' ')).toContain('Нужен непрерывный период');
});
it('rejects holiday boundaries on every period, including isolated holidays', () => {
  const issues = vacationIssues([...range('2027-07-01', 28), '2027-05-01', ...range('2027-06-01', 12)]).join(' ');
  expect(issues).toContain('начинается с праздника');
  expect(issues).toContain('заканчивается праздником');
});
it('deduplicates days and returns both missing minimum and missing period', () => {
  const issues = vacationIssues(Array(28).fill('2027-07-01'));
  expect(issues).toHaveLength(2);
  expect(issues[0]).toContain('Выбрано 1');
});
it('supports periods crossing months and leap day', () => expect(vacationIssues(range('2028-02-24', 30))).toEqual([]));
