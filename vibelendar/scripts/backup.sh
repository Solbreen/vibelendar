#!/usr/bin/env bash
# Консистентная резервная копия SQLite-базы через sqlite3 или better-sqlite3.
# DB_PATH — путь к базе; BACKUP_DIR — каталог копий; KEEP — число хранимых копий.

set -euo pipefail

DB_PATH="${DB_PATH:-./data/vacations.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-30}"

if ! [[ "$KEEP" =~ ^[1-9][0-9]{0,8}$ ]]; then
  echo "KEEP должно быть целым числом от 1 до 999999999" >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Файл базы не найден: $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1 && ! command -v node >/dev/null 2>&1; then
  echo "Не найдены sqlite3 и Node.js для создания резервной копии" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET="$BACKUP_DIR/vacations-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$TARGET'"
else
  SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  node --input-type=module - "$DB_PATH" "$TARGET" "$SCRIPT_DIR/../package.json" <<'JS'
import { createRequire } from 'node:module';

const [source, target, packagePath] = process.argv.slice(2);
const Database = createRequire(packagePath)('better-sqlite3');
const db = new Database(source, { readonly: true, fileMustExist: true });

try {
  await db.backup(target);
} finally {
  db.close();
}
JS
fi

echo "Создана копия: $TARGET"

mapfile -t OLD < <(
  ls -1t "$BACKUP_DIR"/vacations-*.db 2>/dev/null \
    | tail -n "+$((KEEP + 1))"
)

for file in ${OLD+"${OLD[@]}"}; do
  rm -f -- "$file"
  echo "Удалена старая копия: $file"
done

COUNT="$(ls -1 "$BACKUP_DIR"/vacations-*.db 2>/dev/null | wc -l)"
echo "Копий в каталоге: $COUNT (храним последние $KEEP)"
