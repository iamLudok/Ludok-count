// La cuadrilla: altas, renombrar, archivar. Sin imports nativos.
import { eq, sql } from 'drizzle-orm'
import { getDb } from './dbRef'
import { newId } from './ids'
import * as S from './schema'
import { rowToPerson } from './rows'
import type { Person } from '../types'

/**
 * Clave para comparar nombres: sin mayúsculas, sin tildes y sin espacios de
 * más. «Iñaki», «iñaki » e «Inaki» son la misma persona a efectos de no
 * duplicarla, que es lo que pasaba al meter la cuadrilla deprisa.
 */
export function nameKey(name: string): string {
  let plain = name
  // `normalize` depende de ICU, y no todos los motores de Android lo traen
  // completo: si falla, se compara con tildes, que es peor pero no revienta.
  try {
    plain = name.normalize('NFD')
  } catch {}
  return plain
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function cleanName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('El nombre no puede estar vacío.')
  if (clean.length > 40) throw new Error('Nombre demasiado largo (máximo 40 caracteres).')
  return clean
}

export async function listPeople(): Promise<Person[]> {
  const rows = await getDb().select().from(S.people)
  return rows.map(rowToPerson)
}

/**
 * Da de alta a alguien. Si ya existía archivado con ese nombre, se le
 * recupera en vez de crear un doble: así vuelve con todo su historial.
 */
export async function addPerson(name: string): Promise<Person> {
  const clean = cleanName(name)
  const key = nameKey(clean)
  const existing = (await listPeople()).find((p) => nameKey(p.name) === key)
  if (existing && !existing.archivedAt) throw new Error(`Ya hay alguien llamado ${existing.name}.`)
  if (existing) {
    await getDb().update(S.people).set({ archivedAt: null }).where(eq(S.people.id, existing.id))
    return { ...existing, archivedAt: undefined }
  }
  const person: Person = { id: newId(), name: clean, addedAt: Date.now() }
  await getDb().insert(S.people).values({ ...person, archivedAt: null })
  return person
}

/**
 * Alta de varios de golpe, para la bienvenida: acepta un nombre por línea o
 * separados por comas. Los repetidos se saltan en vez de cortar todo el alta.
 */
export async function addPeople(text: string): Promise<{ added: Person[]; skipped: string[] }> {
  const names = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
  const added: Person[] = []
  const skipped: string[] = []
  for (const name of names) {
    try {
      added.push(await addPerson(name))
    } catch {
      skipped.push(name)
    }
  }
  return { added, skipped }
}

export async function renamePerson(id: string, name: string): Promise<void> {
  const clean = cleanName(name)
  const key = nameKey(clean)
  const clash = (await listPeople()).find((p) => p.id !== id && nameKey(p.name) === key)
  if (clash) throw new Error(`Ya hay alguien llamado ${clash.name}.`)
  await getDb().update(S.people).set({ name: clean }).where(eq(S.people.id, id))
}

export async function setPersonArchived(id: string, archived: boolean): Promise<void> {
  await getDb()
    .update(S.people)
    .set({ archivedAt: archived ? Date.now() : null })
    .where(eq(S.people.id, id))
}

/** En cuántos sitios aparece alguien. Si es 0, se puede borrar sin perder nada. */
export async function personUsage(id: string): Promise<number> {
  const db = getDb()
  const count = async (table: typeof S.sushiEntries | typeof S.drinkEntries | typeof S.groupMembers | typeof S.expenseShares) => {
    const r = await db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.personId, id))
    return Number(r[0]?.n ?? 0)
  }
  const paid = await db
    .select({ n: sql<number>`count(*)` })
    .from(S.expenses)
    .where(eq(S.expenses.paidBy, id))
  return (
    (await count(S.sushiEntries)) +
    (await count(S.drinkEntries)) +
    (await count(S.groupMembers)) +
    (await count(S.expenseShares)) +
    Number(paid[0]?.n ?? 0)
  )
}

/**
 * Quitar a alguien: se borra de verdad solo si no aparece en ningún sitio (un
 * nombre mal escrito recién metido). Si tiene historial se archiva, porque
 * borrarlo descuadraría los balances de gastos y las medias de sushi.
 */
export async function removePerson(id: string): Promise<'deleted' | 'archived'> {
  if ((await personUsage(id)) === 0) {
    await getDb().delete(S.people).where(eq(S.people.id, id))
    return 'deleted'
  }
  await setPersonArchived(id, true)
  return 'archived'
}

/** Orden alfabético de verdad en castellano (la ñ en su sitio, sin tildes que molesten). */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
}
