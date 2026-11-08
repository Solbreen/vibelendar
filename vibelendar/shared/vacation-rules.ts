import { countVacationDays, isHoliday } from './holidays.js';

/** Input dates have already passed the API date schema. */
export function vacationIssues(input: string[]): string[] {
  const dates = [...new Set(input)].sort();
  const issues: string[] = [];
  const count = countVacationDays(dates);
  if (count < 28) issues.push(`Выбрано ${count} из необходимых 28 дней без праздников. Добавьте ещё ${28 - count} дн.`);
  const periods: string[][] = [];
  for (const date of dates) {
    const last = periods.at(-1);
    const previous = last?.at(-1);
    if (previous && Date.parse(date) - Date.parse(previous) === 86400_000) last!.push(date);
    else periods.push([date]);
  }
  const longest = Math.max(0, ...periods.map(countVacationDays));
  if (longest < 14) issues.push(`Нужен непрерывный период минимум из 14 дней без учёта праздников. Самый длинный выбранный период — ${longest} дн. Праздники внутри периода должны быть выбраны, но в счёт не входят.`);
  for (const period of periods) {
    const start = period[0]!;
    const end = period.at(-1)!;
    if (isHoliday(start)) issues.push(`Период ${start} — ${end} начинается с праздника. Измените начало отпуска.`);
    if (isHoliday(end)) issues.push(`Период ${start} — ${end} заканчивается праздником. Измените конец отпуска.`);
  }
  return issues;
}
