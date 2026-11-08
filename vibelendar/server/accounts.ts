import { timingSafeEqual, createHash } from 'node:crypto';
import type { Db } from './db.js';
import { getOrCreateUser } from './repo.js';

// Credentials belong exclusively to the server; never include this module in the SPA.
export const accounts = [
  ['Диана', 'Куприна', 'kuprinadn'],
  ['Магомед', 'Барахоев', 'barakhoevml'],
  ['Артем', 'Драгомилов', 'dragomilovaa1'],
  ['Илья', 'Фомичев', 'fomicheviv4'],
  ['Владимир', 'Гриц', 'gritsvv'],
  ['Максим', 'Киктев', 'kiktevmv1'],
  ['Мария', 'Кулешова', 'kuleshovamv5'],
  ['Максим', 'Лысенко', 'lysenkomr1'],
  ['Диана', 'Ногманова', 'nogmanovadi1'],
  ['Александр', 'Архипов', 'akhipovaa20'],
] as const;

export function fixedUsers(db: Db) {
  return accounts.map(([first, last]) => getOrCreateUser(db, first, last).user);
}

export function accountIndex(password: string): number {
  const digest = (text: string) => createHash('sha256').update(text).digest();
  return accounts.findIndex(([, , expected]) => timingSafeEqual(digest(password), digest(expected)));
}
