import { parseIsoDate } from './dates.js';

export interface Holiday {
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  name: string;
}

/**
 * Нерабочие праздничные дни. Даты одинаковы из года в год и применяются
 * к VACATION_YEAR. Переносы выходных 2027 года описаны отдельно ниже.
 *
 * Единственный источник правды: используется и сервером (подсчёт dayCount),
 * и клиентом (подсветка ячеек, подсказки, счётчики).
 */
export const HOLIDAYS: readonly Holiday[] = [
  { month: 1, day: 1, name: 'Новогодние каникулы' },
  { month: 1, day: 2, name: 'Новогодние каникулы' },
  { month: 1, day: 3, name: 'Новогодние каникулы' },
  { month: 1, day: 4, name: 'Новогодние каникулы' },
  { month: 1, day: 5, name: 'Новогодние каникулы' },
  { month: 1, day: 6, name: 'Новогодние каникулы' },
  { month: 1, day: 7, name: 'Рождество Христово' },
  { month: 1, day: 8, name: 'Новогодние каникулы' },
  { month: 2, day: 23, name: 'День защитника Отечества' },
  { month: 3, day: 8, name: 'Международный женский день' },
  { month: 5, day: 1, name: 'Праздник Весны и Труда' },
  { month: 5, day: 9, name: 'День Победы' },
  { month: 6, day: 12, name: 'День России' },
  { month: 11, day: 4, name: 'День народного единства' },
];

/** Выходные, перенесённые постановлением для производственного календаря 2027 года. */
export const TRANSFERRED_DAYS_OFF_2027 = new Set([
  '2027-02-22',
  '2027-11-05',
  '2027-12-31',
]);

/** Субботы и воскресенья, с которых перенесён выходной. */
export const TRANSFERRED_WORKING_DAYS_2027 = new Set([
  '2027-01-02',
  '2027-01-03',
  '2027-02-20',
]);

/**
 * Признак выходного по производственному календарю.
 * Праздники проверяются отдельно: 2 и 3 января остаются нерабочими праздниками.
 */
export function isProductionWeekend(date: string): boolean {
  const parsed = parseIsoDate(date);
  if (!parsed) return false;
  if (TRANSFERRED_DAYS_OFF_2027.has(date)) return true;
  if (TRANSFERRED_WORKING_DAYS_2027.has(date)) return false;
  const day = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  return day === 0 || day === 6;
}

/** Ключ 'MM-DD' → название праздника. */
const HOLIDAY_BY_MONTH_DAY = new Map<string, string>(
  HOLIDAYS.map((holiday) => [monthDayKey(holiday.month, holiday.day), holiday.name]),
);

function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Название праздника для даты 'YYYY-MM-DD' или null. Год значения не имеет. */
export function findHolidayName(date: string): string | null {
  const parsed = parseIsoDate(date);
  if (!parsed) return null;
  return HOLIDAY_BY_MONTH_DAY.get(monthDayKey(parsed.month, parsed.day)) ?? null;
}

export function isHoliday(date: string): boolean {
  return findHolidayName(date) !== null;
}

/**
 * Даты, которые идут в зачёт: существующие, неповторяющиеся и не праздничные.
 * Общий счётчик и разбивка по месяцам строятся на одной и той же выборке,
 * поэтому их результаты не могут разойтись.
 */
function* countedDates(dates: Iterable<string>): Generator<{ date: string; month: number }> {
  for (const date of new Set(dates)) {
    const parsed = parseIsoDate(date);
    if (!parsed) continue;
    if (HOLIDAY_BY_MONTH_DAY.has(monthDayKey(parsed.month, parsed.day))) continue;
    yield { date, month: parsed.month };
  }
}

/**
 * Количество засчитанных дней отпуска: праздники выбрать можно,
 * но в счёт они не идут. Выходные считаются как обычные дни.
 * Дубликаты в наборе игнорируются.
 */
export function countVacationDays(dates: Iterable<string>): number {
  let count = 0;
  for (const _ of countedDates(dates)) count += 1;
  return count;
}

export interface MonthlyVacationCount {
  /** 1..12 */
  month: number;
  count: number;
}

/**
 * Разбивка засчитанных дней по месяцам в хронологическом порядке.
 * Месяцы без засчитанных дней в результат не попадают, поэтому
 * сумма count всегда равна countVacationDays от того же набора.
 */
export function countVacationDaysByMonth(dates: Iterable<string>): MonthlyVacationCount[] {
  const counts = new Map<number, number>();
  for (const { month } of countedDates(dates)) {
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month - b.month);
}
