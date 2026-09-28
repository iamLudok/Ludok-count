/**
 * Verificación del formato de copia: la ida y vuelta de los datos.
 *
 * Ejecuta el MISMO `backupCore` que corre en el móvil, pero contra un SQLite de
 * escritorio, y el mismo DDL que crea la app.
 */
// libsql y no better-sqlite3: better-sqlite3 es sincrónico y no admite
// transacciones asíncronas, mientras expo-sqlite (el del móvil) sí. Con libsql
// la semántica async coincide con la real y se ejecuta el mismo código.
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableName } from 'drizzle-orm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import * as schema from '../src/lib/schema'
import { CREATE_SQL } from '../src/lib/schemaSql'
import {
  exportAll,
  importBackup,
  readSettings,
  writeSettings,
  TABLES,
  type AppDb,
} from '../src/lib/backupCore'
import type { BackupFile, SushiEntry, ExpenseShare, Expense } from '../src/types'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

// Fichero temporal en vez de ':memory:': una base en memoria NO se comparte
// entre conexiones, y las transacciones abren la suya, así que las tablas
// desaparecían dentro de la transacción. Con fichero se comporta como en el
// móvil, que también usa un fichero.
const tempFiles: string[] = []
let dbSeq = 0
let lastClient: Client
async function freshDb(): Promise<AppDb> {
  const path = join(tmpdir(), `ludok-count-verify-${process.pid}-${dbSeq++}.db`)
  rmSync(path, { force: true })
  tempFiles.push(path)
  lastClient = createClient({ url: `file:${path}` })
  await lastClient.executeMultiple(CREATE_SQL)
  return drizzle(lastClient, { schema }) as unknown as AppDb
}
function cleanupTempFiles() {
  for (const f of tempFiles) for (const s of ['', '-wal', '-shm']) rmSync(f + s, { force: true })
}

/* --- Una copia con un poco de todo, huecos incluidos --------------------- */

const backup: BackupFile = {
  app: 'ludok-count',
  schemaVersion: 1,
  exportedAt: 1760000000000,
  people: [
    { id: 'p-ane', name: 'Ane', addedAt: 1 },
    { id: 'p-iker', name: 'Iker', addedAt: 2 },
    // Archivado: el campo opcional presente.
    { id: 'p-mikel', name: 'Mikel', addedAt: 3, archivedAt: 1760000000500 },
    { id: 'p-nerea', name: 'Nerea', addedAt: 4 },
  ],
  sushiSessions: [
    { id: 's1', date: 1759000000000, place: 'Sushi Bar Donosti', note: 'Récord de Iker', createdAt: 10 },
    // Sin sitio ni nota: los huecos importan.
    { id: 's2', date: 1759500000000, createdAt: 11 },
  ],
  sushiEntries: [
    { id: 'se1', sessionId: 's1', personId: 'p-ane', pieces: 34 },
    { id: 'se2', sessionId: 's1', personId: 'p-iker', pieces: 61 },
    // Fue y no comió: 0 no es lo mismo que no ir.
    { id: 'se3', sessionId: 's2', personId: 'p-mikel', pieces: 0 },
  ],
  drinkTypes: [
    { id: 't-chupito', name: 'Chupito', sortOrder: 0 },
    { id: 't-cerveza', name: 'Cerveza', sortOrder: 1, archivedAt: 1760000000600 },
  ],
  drinkSessions: [
    { id: 'd1', date: 1759100000000, title: 'Fiestas', place: 'Bilbo', createdAt: 20 },
    { id: 'd2', date: 1759200000000, createdAt: 21 },
  ],
  drinkEntries: [
    { id: 'de1', sessionId: 'd1', personId: 'p-ane' },
    { id: 'de2', sessionId: 'd1', personId: 'p-iker' },
  ],
  drinkCounts: [
    { id: 'dc1', entryId: 'de1', typeId: 't-chupito', count: 4 },
    { id: 'dc2', entryId: 'de2', typeId: 't-cerveza', count: 3 },
  ],
  groups: [
    { id: 'g1', name: 'Viaje a Asturias', createdAt: 30 },
    { id: 'g2', name: 'Cena vieja', createdAt: 31, archivedAt: 1760000000700 },
  ],
  groupMembers: [
    { id: 'gm1', groupId: 'g1', personId: 'p-ane' },
    { id: 'gm2', groupId: 'g1', personId: 'p-iker' },
  ],
  expenses: [
    {
      id: 'e1',
      groupId: 'g1',
      kind: 'expense',
      title: 'Gasolina',
      amount: 6001,
      paidBy: 'p-ane',
      date: 1759300000000,
      splitMode: 'equal',
      createdAt: 40,
    },
    {
      id: 'e2',
      groupId: 'g1',
      kind: 'transfer',
      title: 'Reembolso',
      amount: 1000,
      paidBy: 'p-iker',
      date: 1759400000000,
      splitMode: 'amounts',
      createdAt: 41,
    },
  ],
  expenseShares: [
    { id: 'es1', expenseId: 'e1', personId: 'p-ane', weight: 1, amount: 3001 },
    { id: 'es2', expenseId: 'e1', personId: 'p-iker', weight: 1, amount: 3000 },
    { id: 'es3', expenseId: 'e2', personId: 'p-ane', weight: 1000, amount: 1000 },
  ],
  musMatches: [
    {
      // Cerrada, con nota: los huecos importan al revés también.
      id: 'm1',
      date: 1759000000000,
      target: 40,
      team1Player1: 'p-ane',
      team1Player2: 'p-iker',
      team2Player1: 'p-mikel',
      team2Player2: 'p-nerea',
      team1Score: 40,
      team2Score: 28,
      winner: 1,
      note: 'Órdago en la última',
      createdAt: 1,
      finishedAt: 1759000900000,
    },
    {
      // En juego: sin ganador ni fecha de cierre, ni nota.
      id: 'm2',
      date: 1759500000000,
      target: 40,
      team1Player1: 'p-ane',
      team1Player2: 'p-mikel',
      team2Player1: 'p-iker',
      team2Player2: 'p-nerea',
      team1Score: 12,
      team2Score: 15,
      createdAt: 2,
    },
  ],
  settings: {
    id: 'app',
    theme: 'dark',
    lastBackup: 1760000000000,
    onboardedAt: 1750000000000,
    mePersonId: 'p-ane',
    schemaVersion: 1,
  },
}

async function main() {
  console.log('\n=== 1. La copia cubre TODAS las tablas del esquema ===')
  // El fallo que más asusta con once tablas: añadir una y olvidarla en la
  // exportación. Esto lo pilla comparando con lo que de verdad crea CREATE_SQL.
  await freshDb()
  const res = await lastClient.execute("SELECT name FROM sqlite_master WHERE type='table'")
  const real = res.rows.map((r) => String(r.name)).filter((n) => n !== 'settings').sort()
  const covered = TABLES.map((t) => getTableName(t.table)).sort()
  check('TABLES = tablas del esquema (sin settings)', JSON.stringify(real) === JSON.stringify(covered),
    `esquema: ${real.join(',')} · copia: ${covered.join(',')}`)

  console.log('\n=== 2. Ida y vuelta, campo a campo ===')
  const db = await freshDb()
  const imported = await importBackup(db, JSON.stringify(backup), 'replace')
  eq('personas importadas', imported.people, 4)
  eq('repartos importados', imported.expenseShares, 3)
  const out = await exportAll(db)
  for (const spec of TABLES) {
    const before = (backup[spec.key] as { id: string }[]).map(sorted).sort(byId)
    const after = (out[spec.key] as { id: string }[]).map(sorted).sort(byId)
    const same = JSON.stringify(before) === JSON.stringify(after)
    check(`${spec.key} idéntico`, same, same ? '' : `\n    antes: ${JSON.stringify(before)}\n    ahora: ${JSON.stringify(after)}`)
  }
  eq('tema restaurado', out.settings?.theme, 'dark')
  eq('quién eres tú restaurado', out.settings?.mePersonId, 'p-ane')
  eq('app correcta', out.app, 'ludok-count')
  eq('schemaVersion exportada', out.schemaVersion, 1)

  console.log('\n=== 3. Los huecos siguen siendo huecos (no null) ===')
  const s2 = out.sushiSessions.find((s) => s.id === 's2')!
  check('sesión sin sitio: el campo ni aparece', !('place' in stripUndef(s2)))
  const ane = out.people.find((p) => p.id === 'p-ane')!
  check('persona activa sin archivedAt', !('archivedAt' in stripUndef(ane)))
  eq('el que fue y no comió sigue con 0', out.sushiEntries.find((e) => e.id === 'se3')?.pieces, 0)
  const m2 = out.musMatches.find((m) => m.id === 'm2')!
  check('partida en juego sin ganador: el campo ni aparece', !('winner' in stripUndef(m2)))
  check('ni la fecha de cierre', !('finishedAt' in stripUndef(m2)))
  check('ni la nota', !('note' in stripUndef(m2)))
  eq('la cerrada sí lleva ganador', out.musMatches.find((m) => m.id === 'm1')?.winner, 1)
  check('el JSON exportado no contiene ningún null', !JSON.stringify(out).includes('null'))

  console.log('\n=== 4. Fusionar sin mezclar filas (el fallo de excluded) ===')
  const db2 = await freshDb()
  await importBackup(db2, JSON.stringify(backup), 'replace')
  const edited: BackupFile = {
    ...backup,
    people: [{ id: 'p-nuevo', name: 'Xabier', addedAt: 9 }],
    sushiEntries: [
      { ...backup.sushiEntries[0], pieces: 40 },
      { ...backup.sushiEntries[1], pieces: 70 },
    ],
    expenseShares: [],
    expenses: [],
  }
  await importBackup(db2, JSON.stringify(edited), 'merge')
  const merged = await exportAll(db2)
  eq('fusionar añade gente sin borrar a nadie', merged.people.length, 5)
  // Aquí es donde un `set` con valor fijo habría puesto lo mismo en las dos:
  eq('se1 con SUS trozos', merged.sushiEntries.find((e) => e.id === 'se1')?.pieces, 40)
  eq('se2 con SUS trozos', merged.sushiEntries.find((e) => e.id === 'se2')?.pieces, 70)
  eq('los gastos que no venían siguen ahí', merged.expenses.length, 2)

  console.log('\n=== 5. Reemplazar vacía de verdad lo anterior ===')
  const db3 = await freshDb()
  await importBackup(db3, JSON.stringify(backup), 'replace')
  const small: BackupFile = { ...backup, people: [backup.people[0]], expenses: [], expenseShares: [] }
  await importBackup(db3, JSON.stringify(small), 'replace')
  const replaced = await exportAll(db3)
  eq('solo queda una persona', replaced.people.length, 1)
  eq('no quedan gastos', replaced.expenses.length, 0)
  eq('ni repartos huérfanos', replaced.expenseShares.length, 0)

  console.log('\n=== 6. Una copia a la que le falta una tabla entra igual ===')
  // Así entrará una copia de hoy cuando mañana haya tablas nuevas.
  const partial = JSON.parse(JSON.stringify(backup))
  delete partial.drinkCounts
  delete partial.expenseShares
  const r6 = await importBackup(await freshDb(), JSON.stringify(partial), 'replace')
  eq('tabla ausente = 0 filas', r6.drinkCounts, 0)
  eq('el resto entra', r6.people, 4)

  console.log('\n=== 7. Volumen grande (troceado de inserts) ===')
  const db4 = await freshDb()
  const manyEntries: SushiEntry[] = Array.from({ length: 5000 }, (_, i) => ({
    id: `bulk-se-${i}`,
    sessionId: `bulk-s-${Math.floor(i / 10)}`,
    personId: `p-${i % 10}`,
    pieces: i % 50,
  }))
  const manyExpenses: Expense[] = Array.from({ length: 1500 }, (_, i) => ({
    id: `bulk-e-${i}`,
    groupId: 'g1',
    kind: 'expense',
    title: `Gasto ${i}`,
    amount: 300,
    paidBy: 'p-ane',
    date: 1759000000000 + i,
    splitMode: 'equal',
    createdAt: i,
  }))
  const manyShares: ExpenseShare[] = manyExpenses.flatMap((e) => [
    { id: `${e.id}-a`, expenseId: e.id, personId: 'p-ane', weight: 1, amount: 150 },
    { id: `${e.id}-b`, expenseId: e.id, personId: 'p-iker', weight: 1, amount: 150 },
  ])
  const t0 = Date.now()
  const big = await importBackup(
    db4,
    JSON.stringify({ ...backup, sushiEntries: manyEntries, expenses: manyExpenses, expenseShares: manyShares }),
    'replace',
  )
  const ms = Date.now() - t0
  eq('5000 entradas de sushi', big.sushiEntries, 5000)
  eq('3000 repartos', big.expenseShares, 3000)
  const bigOut = await exportAll(db4)
  eq('y salen las mismas', bigOut.sushiEntries.length, 5000)
  eq('trozos totales intactos', bigOut.sushiEntries.reduce((s, e) => s + e.pieces, 0),
    manyEntries.reduce((s, e) => s + e.pieces, 0))
  console.log(`        (${ms} ms)`)

  console.log('\n=== 8. Rechaza lo que no debe aceptar ===')
  await rejects('un JSON inválido', async () => importBackup(await freshDb(), '{no es json', 'replace'))
  await rejects('un JSON que no es de Ludok Count', async () =>
    importBackup(await freshDb(), JSON.stringify({ app: 'ludok-time', items: [] }), 'replace'))
  await rejects('una copia de una versión más nueva', async () =>
    importBackup(await freshDb(), JSON.stringify({ ...backup, schemaVersion: 99 }), 'replace'))
  // Y si falla a mitad, no deja nada a medias: la transacción se deshace.
  const db5 = await freshDb()
  await importBackup(db5, JSON.stringify(backup), 'replace')
  const broken = { ...backup, people: [{ id: 'x', name: null, addedAt: 1 }] }
  await rejects('una fila rota', async () => importBackup(db5, JSON.stringify(broken), 'replace'))
  eq('y lo que había sigue entero', (await exportAll(db5)).people.length, 4)

  console.log('\n=== 9. La contraseña de Nextcloud NO sale en las copias ===')
  const dbNc = await freshDb()
  await importBackup(dbNc, JSON.stringify(backup), 'replace')
  await writeSettings(dbNc, {
    ...(await readSettings(dbNc)),
    nextcloudUrl: 'https://cloud.example.com',
    nextcloudUser: 'luken',
    nextcloudPassword: 'SECRETO-QUE-NO-DEBE-SALIR',
    nextcloudFolder: 'Ludok Count',
    autoBackup: true,
  })
  const exported = await exportAll(dbNc)
  check('el texto de la copia no contiene la contraseña', !JSON.stringify(exported).includes('SECRETO'))
  check('ni el campo existe', !('nextcloudPassword' in (exported.settings ?? {})))
  eq('la dirección sí se guarda', exported.settings?.nextcloudUrl, 'https://cloud.example.com')
  eq('y la preferencia de subida sola', exported.settings?.autoBackup, true)
  const dbOtro = await freshDb()
  await writeSettings(dbOtro, { ...(await readSettings(dbOtro)), nextcloudPassword: 'LA-MIA' })
  await importBackup(dbOtro, JSON.stringify(exported), 'replace')
  eq('no borra la contraseña ya guardada', (await readSettings(dbOtro)).nextcloudPassword, 'LA-MIA')

  console.log('\n=== 10. Restaurar da la bienvenida por vista ===')
  const dbNuevo = await freshDb()
  const sinBienvenida = { ...backup, settings: { ...backup.settings!, onboardedAt: undefined } }
  await importBackup(dbNuevo, JSON.stringify(sinBienvenida), 'replace')
  check('onboardedAt queda puesto', (await readSettings(dbNuevo)).onboardedAt !== undefined)

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — los datos entran y salen sin perder nada\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanupTempFiles()
  process.exit(failures === 0 ? 0 : 1)
}

/** Quita las claves undefined, para comparar solo lo que llega al JSON. */
function stripUndef<T extends object>(o: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(o))
}
/** Normaliza el orden de claves para poder comparar dos objetos como texto. */
function sorted(o: object): Record<string, unknown> & { id: string } {
  const plain = stripUndef(o)
  return Object.fromEntries(Object.keys(plain).sort().map((k) => [k, plain[k]])) as Record<string, unknown> & {
    id: string
  }
}
function byId(a: { id: string }, b: { id: string }) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

async function rejects(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    check(`rechaza ${label}`, false, 'no lanzó error')
  } catch {
    check(`rechaza ${label}`, true)
  }
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  cleanupTempFiles()
  process.exit(1)
})
