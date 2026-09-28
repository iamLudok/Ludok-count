/**
 * Versión del formato de las COPIAS DE SEGURIDAD (no la del esquema de SQLite,
 * que es `DB_VERSION` en `schemaSql.ts` y va por su cuenta).
 *
 * `importBackup` rechaza copias con un número mayor que este. Solo se sube si
 * el formato cambia de forma que una versión vieja de la app no lo entendería.
 *
 * Vive en un módulo propio y sin dependencias para que lo puedan usar tanto los
 * mapeadores de filas como el núcleo de copias sin crear un ciclo de imports.
 */
export const SCHEMA_VERSION = 1
