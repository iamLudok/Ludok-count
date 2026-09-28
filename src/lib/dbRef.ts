// `AppDb` se declara en `backupCore.ts` y es simplemente cualquier base SQLite
// de Drizzle: expo-sqlite en el móvil, libsql en las pruebas.
//   export type AppDb = BaseSQLiteDatabase<any, any, any>
import type { AppDb } from './backupCore'

/**
 * Referencia a la base de datos en uso, sin importar nada nativo.
 *
 * La lógica de negocio (`library.ts`, `settings.ts`) pide la base por aquí en
 * vez de crearla ella, para no arrastrar `expo-sqlite` a la cadena de imports.
 * Así esas reglas se pueden ejecutar y comprobar en el escritorio, que es lo
 * que evita que un fallo ahí aparezca tarde y se confunda con un fallo de la
 * interfaz.
 *
 * En el móvil la registra `db.ts` al arrancar; en las pruebas, el script de
 * verificación con un SQLite de escritorio.
 */
let current: AppDb | null = null

export function setDb(database: AppDb): void {
  current = database
}

export function getDb(): AppDb {
  if (!current) {
    throw new Error('La base de datos no está inicializada (falta llamar a setDb).')
  }
  return current
}
