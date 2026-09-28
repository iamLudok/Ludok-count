// Núcleo de las copias de seguridad: solo consultas Drizzle, sin nada nativo.
//
// Está separado de `backup.ts` a propósito. Aquí no se importa expo-file-system
// ni expo-sqlite, así que este código se puede ejecutar tal cual en Node contra
// un SQLite de escritorio para probarlo. Como recibe la base de datos por
// parámetro, el test ejecuta EXACTAMENTE el mismo código que corre en el móvil,
// que es lo único que hace que la prueba valga para algo.
import { eq } from 'drizzle-orm'
import type { BaseSQLiteDatabase, SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as S from './schema'
import * as R from './rows'
import { chunk, excludedSet } from './sqlHelpers'
import { SCHEMA_VERSION } from './version'
import type { BackupFile, Settings } from '../types'

export { SCHEMA_VERSION }

/** Cualquier base de datos SQLite de Drizzle (expo-sqlite en el móvil, libsql en las pruebas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = BaseSQLiteDatabase<any, any, any>

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  lastBackup: 0,
  schemaVersion: SCHEMA_VERSION,
}

export async function readSettings(database: AppDb): Promise<Settings> {
  const rows = await database.select().from(S.settings).where(eq(S.settings.id, 'app')).limit(1)
  // Se reutiliza `rowToSettings` en vez de repetir aquí el mapeo: tenerlo dos
  // veces ya provocó en Ludok Time que campos nuevos se leyeran en un sitio y
  // en el otro no.
  return rows[0] ? R.rowToSettings(rows[0]) : DEFAULT_SETTINGS
}

export async function writeSettings(database: AppDb, next: Settings): Promise<void> {
  const row = R.settingsToRow(next)
  await database.insert(S.settings).values(row).onConflictDoUpdate({ target: S.settings.id, set: row })
}

/**
 * Todas las tablas de datos con su clave en el fichero y sus traductores.
 *
 * Una lista y no once bloques copiados: con tantas tablas, el fallo que de
 * verdad asusta es añadir una y olvidarla en la exportación o en el borrado
 * previo de «reemplazar». `verify/data.ts` comprueba que esta lista cubre
 * todas las tablas del esquema.
 */
type Key = Exclude<keyof BackupFile, 'app' | 'schemaVersion' | 'exportedAt' | 'settings'>
interface TableSpec {
  key: Key
  table: SQLiteTable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fromRow: (r: any) => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toRow: (d: any) => Record<string, unknown>
}

export const TABLES: TableSpec[] = [
  { key: 'people', table: S.people, fromRow: R.rowToPerson, toRow: R.personToRow },
  { key: 'sushiSessions', table: S.sushiSessions, fromRow: R.rowToSushiSession, toRow: R.sushiSessionToRow },
  { key: 'sushiEntries', table: S.sushiEntries, fromRow: R.rowToSushiEntry, toRow: R.sushiEntryToRow },
  { key: 'drinkTypes', table: S.drinkTypes, fromRow: R.rowToDrinkType, toRow: R.drinkTypeToRow },
  { key: 'drinkSessions', table: S.drinkSessions, fromRow: R.rowToDrinkSession, toRow: R.drinkSessionToRow },
  { key: 'drinkEntries', table: S.drinkEntries, fromRow: R.rowToDrinkEntry, toRow: R.drinkEntryToRow },
  { key: 'drinkCounts', table: S.drinkCounts, fromRow: R.rowToDrinkCount, toRow: R.drinkCountToRow },
  { key: 'groups', table: S.expenseGroups, fromRow: R.rowToGroup, toRow: R.groupToRow },
  { key: 'groupMembers', table: S.groupMembers, fromRow: R.rowToGroupMember, toRow: R.groupMemberToRow },
  { key: 'expenses', table: S.expenses, fromRow: R.rowToExpense, toRow: R.expenseToRow },
  { key: 'expenseShares', table: S.expenseShares, fromRow: R.rowToShare, toRow: R.shareToRow },
  { key: 'musMatches', table: S.musMatches, fromRow: R.rowToMusMatch, toRow: R.musMatchToRow },
]

/** Serializa toda la base de datos a un objeto de copia. */
export async function exportAll(database: AppDb): Promise<BackupFile> {
  const out: Record<string, unknown> = {
    app: 'ludok-count',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
  }
  for (const spec of TABLES) {
    const rows = await database.select().from(spec.table)
    out[spec.key] = rows.map(spec.fromRow)
  }

  // La contraseña de Nextcloud NO se exporta. Una copia se comparte y se mueve
  // de sitio, y esa contraseña da permiso de ESCRITURA sobre tus ficheros; la
  // propia copia acaba subida ahí, así que además viajaría con su propia llave
  // dentro. Al restaurar en otro móvil hay que volver a escribirla, y punto.
  const { nextcloudPassword: _omitted, ...safeSettings } = await readSettings(database)
  out.settings = safeSettings

  return out as unknown as BackupFile
}

export type ImportResult = Record<Key, number>

/**
 * Importa una copia. 'replace' vacía antes lo que haya; 'merge' añade/actualiza
 * por id sin borrar nada. Todo dentro de una transacción: si algo falla a mitad
 * no se queda la base de datos a medias.
 */
export async function importBackup(
  database: AppDb,
  raw: string,
  mode: 'replace' | 'merge' = 'replace',
): Promise<ImportResult> {
  let parsed: Partial<BackupFile>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El fichero no es un JSON válido.')
  }
  if (!parsed || parsed.app !== 'ludok-count' || !Array.isArray(parsed.people)) {
    throw new Error('Esto no parece una copia de Ludok Count.')
  }
  if ((parsed.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error(
      `La copia es de una versión más nueva (v${parsed.schemaVersion}). Actualiza la app antes de importar.`,
    )
  }

  const result = {} as ImportResult
  await database.transaction(async (tx: AppDb) => {
    if (mode === 'replace') {
      for (const spec of TABLES) await tx.delete(spec.table)
    }
    for (const spec of TABLES) {
      // Una tabla ausente es una lista vacía: así una copia de antes de que
      // existiera esa tabla sigue entrando sin más.
      const incoming = (parsed[spec.key] ?? []) as unknown[]
      if (!Array.isArray(incoming)) throw new Error(`La copia trae «${spec.key}» con una forma rara.`)
      for (const part of chunk(incoming)) {
        await tx
          .insert(spec.table)
          .values(part.map(spec.toRow))
          .onConflictDoUpdate({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: (spec.table as any).id,
            set: excludedSet(spec.table),
          })
      }
      result[spec.key] = incoming.length
    }
  })

  // Las preferencias se restauran, pero se conserva la schemaVersion actual.
  // La contraseña de Nextcloud no viene en la copia (no se exporta), así que se
  // mantiene la que ya hubiera en este móvil. `onboardedAt` se marca: quien
  // restaura una copia ya sabe de qué va la app.
  const current = await readSettings(database)
  const s = parsed.settings
  await writeSettings(database, {
    ...current,
    theme: s?.theme || current.theme,
    nextcloudUrl: s?.nextcloudUrl || current.nextcloudUrl,
    nextcloudUser: s?.nextcloudUser || current.nextcloudUser,
    nextcloudFolder: s?.nextcloudFolder || current.nextcloudFolder,
    autoBackup: s?.autoBackup ?? current.autoBackup,
    mePersonId: s?.mePersonId || current.mePersonId,
    onboardedAt: current.onboardedAt ?? s?.onboardedAt ?? Date.now(),
    id: 'app',
  })

  return result
}

/** Días transcurridos desde la última copia. Infinity si nunca se ha hecho. */
export function daysSinceBackup(lastBackup: number): number {
  if (!lastBackup) return Infinity
  return Math.floor((Date.now() - lastBackup) / 86_400_000)
}
