import { getTableColumns, sql } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

/**
 * Trocea los inserts: SQLite limita el número de variables por sentencia, y al
 * importar una copia con años de sesiones y gastos entran miles de filas de golpe.
 */
export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * `set` para un upsert: actualiza todas las columnas menos la clave, tomando el
 * valor de la fila que se intentaba insertar (`excluded`).
 *
 * Tiene que ser `excluded.*` y no un valor fijo: en un insert de varias filas a
 * la vez, un valor fijo aplicaría a TODAS las filas en conflicto los datos de
 * una sola, mezclando filas entre sí (ya pasó en Ludok Time). Las columnas se derivan del
 * esquema para que no se olvide ninguna al añadir campos al modelo.
 */
export function excludedSet(table: SQLiteTable): Record<string, unknown> {
  const set: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(getTableColumns(table))) {
    if (key === 'id') continue
    set[key] = sql.raw(`excluded."${col.name}"`)
  }
  return set
}
