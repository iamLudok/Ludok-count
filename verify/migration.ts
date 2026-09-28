/**
 * Verificación de las migraciones de esquema.
 *
 * Una instalación que se actualiza pasa por `CREATE_SQL` + `MIGRATIONS`; una
 * nueva, solo por `CREATE_SQL`. Las dos tienen que acabar con EXACTAMENTE el
 * mismo esquema, y la que se actualiza sin perder ni una fila. Si un paso
 * falla, la app no arranca en el móvil de quien ya la tenía.
 */
import { createClient, type Client } from '@libsql/client'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { CREATE_SQL, MIGRATIONS, DB_VERSION } from '../src/lib/schemaSql'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

/**
 * El esquema tal y como se instaló en la v1, CONGELADO. No se importa de
 * `schemaSql.ts` a propósito: `CREATE_SQL` va cambiando con cada versión, y
 * esto tiene que seguir siendo lo que tiene hoy en el móvil quien instaló la
 * primera. Aquí no se toca nunca.
 */
const V1_SQL = `
CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, addedAt INTEGER NOT NULL, archivedAt INTEGER);
CREATE TABLE IF NOT EXISTS sushi_sessions (id TEXT PRIMARY KEY NOT NULL, date INTEGER NOT NULL, place TEXT, note TEXT, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sushi_entries (id TEXT PRIMARY KEY NOT NULL, sessionId TEXT NOT NULL, personId TEXT NOT NULL, pieces INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS drink_types (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, sortOrder INTEGER NOT NULL DEFAULT 0, archivedAt INTEGER);
CREATE TABLE IF NOT EXISTS drink_sessions (id TEXT PRIMARY KEY NOT NULL, date INTEGER NOT NULL, title TEXT, place TEXT, note TEXT, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS drink_entries (id TEXT PRIMARY KEY NOT NULL, sessionId TEXT NOT NULL, personId TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drink_counts (id TEXT PRIMARY KEY NOT NULL, entryId TEXT NOT NULL, typeId TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS expense_groups (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, createdAt INTEGER NOT NULL, archivedAt INTEGER);
CREATE TABLE IF NOT EXISTS group_members (id TEXT PRIMARY KEY NOT NULL, groupId TEXT NOT NULL, personId TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY NOT NULL, groupId TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, amount INTEGER NOT NULL, paidBy TEXT NOT NULL, date INTEGER NOT NULL, splitMode TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS expense_shares (id TEXT PRIMARY KEY NOT NULL, expenseId TEXT NOT NULL, personId TEXT NOT NULL, weight INTEGER NOT NULL, amount INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY NOT NULL, theme TEXT NOT NULL DEFAULT 'system', lastBackup INTEGER NOT NULL DEFAULT 0, onboardedAt INTEGER, nextcloudUrl TEXT, nextcloudUser TEXT, nextcloudPassword TEXT, nextcloudFolder TEXT, autoBackup INTEGER, lastAutoBackupAt INTEGER, schemaVersion INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS sushi_entries_session_person_idx ON sushi_entries (sessionId, personId);
CREATE UNIQUE INDEX IF NOT EXISTS drink_entries_session_person_idx ON drink_entries (sessionId, personId);
CREATE UNIQUE INDEX IF NOT EXISTS drink_counts_entry_type_idx ON drink_counts (entryId, typeId);
CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_person_idx ON group_members (groupId, personId);
CREATE INDEX IF NOT EXISTS expenses_group_idx ON expenses (groupId);
CREATE INDEX IF NOT EXISTS expense_shares_expense_idx ON expense_shares (expenseId);
`

const files: string[] = []
function tmpFile(name: string): string {
  const path = join(tmpdir(), `ludok-count-mig-${process.pid}-${name}.db`)
  for (const s of ['', '-wal', '-shm']) rmSync(path + s, { force: true })
  files.push(path)
  return path
}
function cleanup() {
  for (const f of files) for (const s of ['', '-wal', '-shm']) rmSync(f + s, { force: true })
}

/** Reproduce exactamente lo que hace `migrateSync()` en `src/lib/db.ts`. */
async function migrate(client: Client): Promise<void> {
  const row = await client.execute('PRAGMA user_version')
  const current = Number(row.rows[0]?.user_version ?? 0)
  if (current >= DB_VERSION) return
  await client.executeMultiple(CREATE_SQL)
  if (current > 0) {
    for (const step of MIGRATIONS.slice(current - 1)) await client.executeMultiple(step)
  }
  await client.execute(`PRAGMA user_version = ${DB_VERSION}`)
}

/** Todo el esquema como texto comparable: tablas con sus columnas, e índices. */
async function shape(client: Client): Promise<string> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  const out: string[] = []
  for (const t of tables.rows) {
    const cols = await client.execute(`PRAGMA table_info(${String(t.name)})`)
    const desc = cols.rows
      .map((c) => `${c.name}:${c.type}:${c.notnull}:${c.dflt_value}:${c.pk}`)
      .sort()
      .join(',')
    out.push(`${t.name}(${desc})`)
  }
  const idx = await client.execute(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  for (const i of idx.rows) out.push(`idx ${i.name} on ${i.tbl_name}`)
  return out.join('\n')
}

async function main() {
  console.log('\n=== 1. Instalación NUEVA ===')
  const fresh = createClient({ url: `file:${tmpFile('fresh')}` })
  await migrate(fresh)
  const v = await fresh.execute('PRAGMA user_version')
  eq('user_version al día', Number(v.rows[0]?.user_version), DB_VERSION)
  const tables = await fresh.execute("SELECT count(*) AS n FROM sqlite_master WHERE type='table'")
  eq('doce tablas', Number(tables.rows[0]?.n), 12)

  console.log('\n=== 2. Instalación de la v1 CON DATOS: se migra sin perder nada ===')
  const old = createClient({ url: `file:${tmpFile('old')}` })
  await old.executeMultiple(V1_SQL)
  await old.execute('PRAGMA user_version = 1')
  await old.execute({ sql: 'INSERT INTO people (id,name,addedAt) VALUES (?,?,?)', args: ['p1', 'Ane', 1] })
  await old.execute({
    sql: 'INSERT INTO sushi_sessions (id,date,place,createdAt) VALUES (?,?,?,?)',
    args: ['s1', 1759000000000, 'Sushi Bar', 1],
  })
  await old.execute({
    sql: 'INSERT INTO sushi_entries (id,sessionId,personId,pieces) VALUES (?,?,?,?)',
    args: ['e1', 's1', 'p1', 48],
  })
  await old.execute({
    sql: `INSERT INTO expenses (id,groupId,kind,title,amount,paidBy,date,splitMode,createdAt)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: ['x1', 'g1', 'expense', 'Cena', 4550, 'p1', 1, 'equal', 1],
  })
  await old.execute({
    sql: 'INSERT INTO settings (id,theme,lastBackup,onboardedAt,schemaVersion) VALUES (?,?,?,?,?)',
    args: ['app', 'dark', 123, 456, 1],
  })

  await migrate(old)

  const e1 = await old.execute("SELECT pieces FROM sushi_entries WHERE id = 'e1'")
  eq('los trozos siguen ahí', Number(e1.rows[0]?.pieces), 48)
  const x1 = await old.execute("SELECT amount FROM expenses WHERE id = 'x1'")
  eq('el gasto sigue con sus céntimos', Number(x1.rows[0]?.amount), 4550)
  const st = await old.execute('SELECT theme, onboardedAt FROM settings')
  eq('el tema sigue', String(st.rows[0]?.theme), 'dark')
  eq('y la bienvenida sigue vista', Number(st.rows[0]?.onboardedAt), 456)

  console.log('\n=== 3. Migrar y crear de cero dejan el MISMO esquema ===')
  const a = await shape(fresh)
  const b = await shape(old)
  check('esquema idéntico', a === b, a === b ? '' : `\n--- nueva ---\n${a}\n--- migrada ---\n${b}`)

  console.log('\n=== 4. Migrar dos veces no rompe nada ===')
  await migrate(old)
  const again = await old.execute('SELECT count(*) AS n FROM sushi_entries')
  eq('sigue habiendo una entrada', Number(again.rows[0]?.n), 1)
  const v2 = await old.execute('PRAGMA user_version')
  eq('y la versión no se mueve', Number(v2.rows[0]?.user_version), DB_VERSION)

  console.log(
    failures === 0
      ? '\n✅ LA MIGRACIÓN ES SEGURA — nada se pierde al actualizar\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanup()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  cleanup()
  process.exit(1)
})
