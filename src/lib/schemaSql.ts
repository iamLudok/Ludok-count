/**
 * DDL del esquema local. Vive aparte de `db.ts` (que importa expo-sqlite, y por
 * tanto solo funciona en el móvil) para que las pruebas de escritorio puedan
 * crear EXACTAMENTE el mismo esquema que crea la app. Si esto estuviera
 * duplicado en el test, el test validaría un esquema que no es el real.
 *
 * Sin claves foráneas a propósito: el borrado en cascada lo hace la lógica de
 * `lib/`, que es la que se prueba, y una importación en modo «fusionar» no
 * depende del orden en que lleguen las tablas.
 */
export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  addedAt INTEGER NOT NULL,
  archivedAt INTEGER
);

CREATE TABLE IF NOT EXISTS sushi_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  date INTEGER NOT NULL,
  place TEXT,
  note TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sushi_entries (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL,
  personId TEXT NOT NULL,
  pieces INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drink_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  archivedAt INTEGER
);

CREATE TABLE IF NOT EXISTS drink_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  date INTEGER NOT NULL,
  title TEXT,
  place TEXT,
  note TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drink_entries (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL,
  personId TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drink_counts (
  id TEXT PRIMARY KEY NOT NULL,
  entryId TEXT NOT NULL,
  typeId TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  archivedAt INTEGER
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY NOT NULL,
  groupId TEXT NOT NULL,
  personId TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  groupId TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paidBy TEXT NOT NULL,
  date INTEGER NOT NULL,
  splitMode TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_shares (
  id TEXT PRIMARY KEY NOT NULL,
  expenseId TEXT NOT NULL,
  personId TEXT NOT NULL,
  weight INTEGER NOT NULL,
  amount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  theme TEXT NOT NULL DEFAULT 'system',
  lastBackup INTEGER NOT NULL DEFAULT 0,
  onboardedAt INTEGER,
  nextcloudUrl TEXT,
  nextcloudUser TEXT,
  nextcloudPassword TEXT,
  nextcloudFolder TEXT,
  autoBackup INTEGER,
  lastAutoBackupAt INTEGER,
  schemaVersion INTEGER NOT NULL
);

-- Una persona solo puede estar una vez en cada sesión o grupo: sin esto, un
-- doble toque la metía dos veces y contaba doble en las medias y en el balance.
CREATE UNIQUE INDEX IF NOT EXISTS sushi_entries_session_person_idx ON sushi_entries (sessionId, personId);
CREATE UNIQUE INDEX IF NOT EXISTS drink_entries_session_person_idx ON drink_entries (sessionId, personId);
CREATE UNIQUE INDEX IF NOT EXISTS drink_counts_entry_type_idx ON drink_counts (entryId, typeId);
CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_person_idx ON group_members (groupId, personId);
CREATE INDEX IF NOT EXISTS expenses_group_idx ON expenses (groupId);
CREATE INDEX IF NOT EXISTS expense_shares_expense_idx ON expense_shares (expenseId);
`

/**
 * Cambios de esquema sobre bases ya creadas, en orden. El índice del array + 1
 * es la versión a la que lleva cada paso (`PRAGMA user_version`).
 *
 * `CREATE_SQL` de arriba siempre describe el esquema COMPLETO y actual, así que
 * una instalación nueva no ejecuta ninguno de estos pasos: son solo para bases
 * que ya existían antes del cambio. Editar `CREATE_SQL` sin añadir aquí el paso
 * correspondiente deja rotas todas las instalaciones que ya existen.
 */
export const MIGRATIONS: string[] = []

/** Versión actual del esquema local. */
export const DB_VERSION = MIGRATIONS.length + 1
