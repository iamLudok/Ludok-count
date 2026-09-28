// Ajustes. Sin imports nativos a propósito: el hook reactivo vive en
// `src/hooks/useSettings.ts`, para que esta lógica se pueda probar en Node.
import { eq } from 'drizzle-orm'
import { getDb } from './dbRef'
import { settings as settingsTable } from './schema'
import { DEFAULT_SETTINGS, readSettings, writeSettings } from './backupCore'
import { seedDefaultDrinkTypes } from './drinks'
import type { Settings } from '../types'

export { DEFAULT_SETTINGS }

/** Lectura sola: devuelve los ajustes guardados o los por defecto (sin escribir). */
export function getSettings(): Promise<Settings> {
  return readSettings(getDb())
}

/**
 * Persiste los ajustes por defecto si aún no existen. Llamar una vez al arrancar.
 *
 * Que no haya fila de ajustes es la señal de instalación nueva, y es el único
 * momento en que se siembran los tipos de bebida de serie: hacerlo en cada
 * arranque resucitaría los que el usuario haya quitado.
 */
export async function ensureSettings(): Promise<void> {
  const db = getDb()
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.id, 'app')).limit(1)
  if (rows[0]) return
  await seedDefaultDrinkTypes()
  await writeSettings(db, DEFAULT_SETTINGS)
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await writeSettings(getDb(), { ...current, ...patch, id: 'app' })
}
