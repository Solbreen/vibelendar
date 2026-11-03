import type { UserDto } from '../shared/types.js';
import { accounts } from './accounts.js';
import { isHoliday } from '../shared/holidays.js';

export function overlapIssues(id: number, dates: string[], users: UserDto[]): string[] {
  const issues: string[] = [];
  const groups: [number[], number][] = [[[0, 1], 5], [[1, 6], 0], [[0, 3], 0], [[7, 8], 0], [[5, 4, 9], 0]];
  for (const [indices, limit] of groups) {
    const people = indices.map((index) => users.find((user) => user.firstName === accounts[index]![0] && user.lastName === accounts[index]![1])!);
    if (!people.some((user) => user.id === id)) continue;
    const others = people.filter((user) => user.id !== id).map((user) => new Set(user.days));
    const overlap = dates.filter((date) => !isHoliday(date) && others.every((days) => days.has(date)));
    if (overlap.length > limit) issues.push(`${people.map((user) => user.displayName).join(', ')}: допустимое пересечение — ${limit} дн., выбрано ${overlap.length} (${overlap.join(', ')}).`);
  }
  return issues;
}
