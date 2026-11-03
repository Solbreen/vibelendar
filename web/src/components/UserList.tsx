import type { CalendarUserDto } from '../../../shared/types.js';
import type { MonthlyVacationCount } from '../../../shared/holidays.js';
import { MONTH_NAMES_RU, pluralizeDays } from '../calendar-model.js';
import styles from './UserList.module.css';

export interface UserListEntry {
  user: CalendarUserDto;
  isSelf: boolean;
  hidden: boolean;
  /** Засчитанные дни; для себя — с учётом несохранённых изменений. */
  dayCount: number;
  /** Разбивка засчитанных дней по месяцам, только непустые месяцы. */
  byMonth: MonthlyVacationCount[];
}

interface UserListProps {
  entries: UserListEntry[];
  onToggleHidden: (id: number) => void;
}

export function UserList({
  entries,
  onToggleHidden,
}: UserListProps): JSX.Element {
  return (
    <aside className={styles.panel}>
      <h2 className={styles.heading}>Команда</h2>
      {entries.length === 0 ? <p className={styles.emptyHint}>Пока никого нет</p> : null}
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li
            key={entry.user.id}
            className={entry.hidden ? styles.rowHidden : styles.row}
            data-self={entry.isSelf || undefined}
          >
                <button
                  type="button"
                  className={styles.main}
                  onClick={() => onToggleHidden(entry.user.id)}
                  disabled={entry.isSelf}
                  title={
                    entry.isSelf
                      ? 'Свои дни скрыть нельзя'
                      : entry.hidden
                        ? 'Показать дни на календаре'
                        : 'Скрыть дни с календаря'
                  }
                >
                  <span className={styles.marker} style={{ background: entry.user.color }} />
                  <span className={styles.body}>
                    <span className={styles.nameRow}>
                      <span className={styles.name}>
                        {entry.user.displayName}
                        {entry.isSelf ? <span className={styles.selfTag}> (вы)</span> : null}
                      </span>
                      <span className={styles.count}>
                        {entry.dayCount} {pluralizeDays(entry.dayCount)}
                      </span>
                    </span>
                    {entry.byMonth.length > 0 ? (
                      <span className={styles.months}>
                        {entry.byMonth.map(({ month, count }) => (
                          <span className={styles.month} key={month}>
                            {MONTH_NAMES_RU[month - 1]} — {count}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>

          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        Клик по коллеге скрывает или показывает его дни на календаре. Shift + клик по календарю
        выделяет диапазон.
      </p>
    </aside>
  );
}
