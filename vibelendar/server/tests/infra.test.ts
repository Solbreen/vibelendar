import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { getOrCreateUser, saveDays } from '../repo.js';
import { fixedUsers } from '../accounts.js';
import { migrate, openDb } from '../db.js';
import { closeTestApp, createTestApp, errorOf, login, type TestContext } from './helpers.js';

describe('миграции', () => {
  it('однократно очищает старые данные и сохраняет новые при повторной миграции', () => {
    const db = new Database(':memory:');
    try {
      db.pragma('foreign_keys = ON');
      db.exec(readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8'));
      db.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL); INSERT INTO schema_version VALUES (1, '001_init.sql', '2026-01-01')");
      const old = getOrCreateUser(db, 'Диана', 'Куприна').user;
      saveDays(db, old.id, ['2027-07-01'], 0);
      migrate(db);
      expect(db.prepare('SELECT COUNT(*) AS n FROM vacation_days').get()).toEqual({ n: 0 });
      expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
      const user = fixedUsers(db)[0]!;
      saveDays(db, user.id, ['2027-07-02'], 0);
      migrate(db);
      expect(fixedUsers(db)[0]!.days).toEqual(['2027-07-02']);
    } finally { db.close(); }
  });
  it('создают таблицы и записывают версию схемы', () => {
    const db = openDb(':memory:');
    try {
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((row) => row.name);
      expect(tables).toContain('users');
      expect(tables).toContain('vacation_days');
      expect(tables).toContain('schema_version');

      const version = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
        version: number;
      };
      expect(version.version).toBeGreaterThanOrEqual(1);
    } finally {
      db.close();
    }
  });

  it('идемпотентны при повторном применении', () => {
    const db = openDb(':memory:');
    try {
      const before = db.prepare('SELECT COUNT(*) AS count FROM schema_version').get() as {
        count: number;
      };
      expect(() => migrate(db)).not.toThrow();
      expect(() => migrate(db)).not.toThrow();
      const after = db.prepare('SELECT COUNT(*) AS count FROM schema_version').get() as {
        count: number;
      };
      expect(after.count).toBe(before.count);
    } finally {
      db.close();
    }
  });

  it('включают foreign_keys', () => {
    const db = openDb(':memory:');
    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      // ссылка на несуществующего пользователя должна отвергаться
      expect(() =>
        db.prepare('INSERT INTO vacation_days (user_id, date) VALUES (?, ?)').run(999, '2027-01-01'),
      ).toThrow(/FOREIGN KEY/i);
    } finally {
      db.close();
    }
  });

  describe('файловая база', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'vacations-test-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('включает WAL и переживает переоткрытие', () => {
      const path = join(dir, 'nested', 'vacations.db');
      const first = openDb(path);
      expect(first.pragma('journal_mode', { simple: true })).toBe('wal');
      first
        .prepare(
          'INSERT INTO users (first_name, last_name, name_key, color, version, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        )
        .run('Иван', 'Петров', 'иван петров', '#e4572e', '2026-01-01T00:00:00.000Z');
      first.close();

      const second = openDb(path);
      const row = second.prepare('SELECT first_name, last_name FROM users').get() as {
        first_name: string;
        last_name: string;
      };
      expect(row.first_name).toBe('Иван');
      expect(row.last_name).toBe('Петров');
      second.close();
    });
  });
});

describe('лимит тела запроса', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await closeTestApp(ctx);
  });

  it('отвергает тело больше 64 КБ', async () => {
    const created = await login(ctx.app, 'dragomilovaa1');
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      headers: { cookie: created.cookie },
      payload: { dates: Array.from({ length: 6000 }, () => '2027-01-01'), version: 0 },
    });
    expect(response.statusCode).toBe(413);
    expect(errorOf(response).message).toMatch(/[а-яА-Я]/);
  });

  it('принимает полный год дат (366 строк заметно меньше лимита)', async () => {
    const created = await login(ctx.app, 'dragomilovaa1');
    const dates: string[] = [];
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= new Date(Date.UTC(2027, month, 0)).getUTCDate(); day += 1) {
        dates.push(`2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      headers: { cookie: created.cookie },
      payload: { dates, version: 0 },
    });
    // The body is accepted; holiday boundaries violate the new vacation rules.
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VACATION_RULES');
  });
});
