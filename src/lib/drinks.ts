// Sesiones de bebida: quién estuvo y cuántas de cada tipo lleva cada uno.
// Sin imports nativos: se prueba en `verify/library.ts`.
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from './dbRef'
import { newId } from './ids'
import * as S from './schema'
import { rowToDrinkType } from './rows'
import type { AppDb } from './backupCore'
import type { DrinkCount, DrinkEntry, DrinkSession, DrinkType } from '../types'

/* --- Tipos de bebida ------------------------------------------------------ */

/** Los de serie en una instalación nueva. Se pueden renombrar y quitar. */
export const DEFAULT_DRINK_TYPES = ['Chupito', 'Cerveza', 'Cubata', 'Kalimotxo', 'Vino']

export async function seedDefaultDrinkTypes(): Promise<void> {
  const db = getDb()
  const existing = await db.select().from(S.drinkTypes).limit(1)
  if (existing.length) return
  await db.insert(S.drinkTypes).values(
    DEFAULT_DRINK_TYPES.map((name, i) => ({ id: newId(), name, sortOrder: i, archivedAt: null })),
  )
}

export async function listDrinkTypes(): Promise<DrinkType[]> {
  const rows = await getDb().select().from(S.drinkTypes)
  return rows.map(rowToDrinkType).sort((a, b) => a.sortOrder - b.sortOrder)
}

function cleanTypeName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Ponle un nombre.')
  if (clean.length > 24) throw new Error('Nombre demasiado largo (máximo 24 caracteres).')
  return clean
}

export async function addDrinkType(name: string): Promise<DrinkType> {
  const clean = cleanTypeName(name)
  const all = await listDrinkTypes()
  const same = all.find((t) => t.name.toLowerCase() === clean.toLowerCase())
  if (same && !same.archivedAt) throw new Error(`Ya existe «${same.name}».`)
  // Uno quitado con el mismo nombre vuelve, en vez de duplicarse: así las
  // sesiones viejas y las nuevas suman en el mismo total.
  if (same) {
    await getDb().update(S.drinkTypes).set({ archivedAt: null }).where(eq(S.drinkTypes.id, same.id))
    return { ...same, archivedAt: undefined }
  }
  const type: DrinkType = {
    id: newId(),
    name: clean,
    sortOrder: all.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1,
  }
  await getDb().insert(S.drinkTypes).values({ ...type, archivedAt: null })
  return type
}

export async function renameDrinkType(id: string, name: string): Promise<void> {
  await getDb().update(S.drinkTypes).set({ name: cleanTypeName(name) }).where(eq(S.drinkTypes.id, id))
}

/**
 * Quitar un tipo lo archiva: deja de salir en las sesiones nuevas, pero lo
 * que ya se bebió sigue contando y se ve en las sesiones donde se apuntó.
 */
export async function setDrinkTypeArchived(id: string, archived: boolean): Promise<void> {
  await getDb()
    .update(S.drinkTypes)
    .set({ archivedAt: archived ? Date.now() : null })
    .where(eq(S.drinkTypes.id, id))
}

/** Sube o baja un tipo en la lista, intercambiándolo con su vecino visible. */
export async function moveDrinkType(id: string, direction: -1 | 1): Promise<void> {
  const visible = (await listDrinkTypes()).filter((t) => !t.archivedAt)
  const i = visible.findIndex((t) => t.id === id)
  const j = i + direction
  if (i < 0 || j < 0 || j >= visible.length) return
  // Se renumera toda la lista visible en vez de intercambiar dos números: si
  // alguna vez quedaron dos con el mismo sortOrder (una copia fusionada), el
  // intercambio no movía nada.
  const order = [...visible]
  ;[order[i], order[j]] = [order[j], order[i]]
  await getDb().transaction(async (tx: AppDb) => {
    for (const [k, t] of order.entries()) {
      await tx.update(S.drinkTypes).set({ sortOrder: k }).where(eq(S.drinkTypes.id, t.id))
    }
  })
}

/* --- Sesiones ------------------------------------------------------------- */

export interface DrinkSessionInput {
  date?: number
  title?: string
  place?: string
  note?: string
}

const clean = (s?: string) => (s?.trim() ? s.trim() : null)

export async function createDrinkSession(input: DrinkSessionInput, personIds: string[]): Promise<string> {
  const id = newId()
  const now = Date.now()
  await getDb().transaction(async (tx: AppDb) => {
    await tx.insert(S.drinkSessions).values({
      id,
      date: input.date ?? now,
      title: clean(input.title),
      place: clean(input.place),
      note: clean(input.note),
      createdAt: now,
    })
    const unique = [...new Set(personIds)]
    if (unique.length) {
      await tx.insert(S.drinkEntries).values(unique.map((personId) => ({ id: newId(), sessionId: id, personId })))
    }
  })
  return id
}

export async function updateDrinkSession(id: string, input: DrinkSessionInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.date !== undefined) patch.date = input.date
  if ('title' in input) patch.title = clean(input.title)
  if ('place' in input) patch.place = clean(input.place)
  if ('note' in input) patch.note = clean(input.note)
  if (Object.keys(patch).length) {
    await getDb().update(S.drinkSessions).set(patch).where(eq(S.drinkSessions.id, id))
  }
}

/** Borra la sesión, sus asistentes y todo lo que se apuntó en ella. */
export async function deleteDrinkSession(id: string): Promise<void> {
  await getDb().transaction(async (tx: AppDb) => {
    const entries = await tx.select().from(S.drinkEntries).where(eq(S.drinkEntries.sessionId, id))
    const ids = entries.map((e: DrinkEntry) => e.id)
    if (ids.length) await tx.delete(S.drinkCounts).where(inArray(S.drinkCounts.entryId, ids))
    await tx.delete(S.drinkEntries).where(eq(S.drinkEntries.sessionId, id))
    await tx.delete(S.drinkSessions).where(eq(S.drinkSessions.id, id))
  })
}

export async function addDrinkAttendee(sessionId: string, personId: string): Promise<void> {
  await getDb()
    .insert(S.drinkEntries)
    .values({ id: newId(), sessionId, personId })
    .onConflictDoNothing()
}

/** Quita a alguien de la sesión, con lo que tuviera apuntado. */
export async function removeDrinkAttendee(sessionId: string, personId: string): Promise<void> {
  await getDb().transaction(async (tx: AppDb) => {
    const rows = await tx
      .select()
      .from(S.drinkEntries)
      .where(and(eq(S.drinkEntries.sessionId, sessionId), eq(S.drinkEntries.personId, personId)))
    for (const e of rows as DrinkEntry[]) {
      await tx.delete(S.drinkCounts).where(eq(S.drinkCounts.entryId, e.id))
      await tx.delete(S.drinkEntries).where(eq(S.drinkEntries.id, e.id))
    }
  })
}

/**
 * Suma (o resta) una bebida de un tipo. Un solo upsert en SQL, por lo mismo
 * que los trozos de sushi: varios toques seguidos no pueden pisarse entre sí.
 * La primera vez que alguien pide un tipo, la fila se crea aquí mismo.
 */
export async function addDrink(entryId: string, typeId: string, delta: number): Promise<void> {
  const d = Math.trunc(delta)
  await getDb()
    .insert(S.drinkCounts)
    .values({ id: newId(), entryId, typeId, count: Math.max(0, d) })
    .onConflictDoUpdate({
      target: [S.drinkCounts.entryId, S.drinkCounts.typeId],
      set: { count: sql`max(0, ${S.drinkCounts.count} + ${d})` },
    })
}

/* --- Estadísticas (puras) ------------------------------------------------- */

/** Total de una persona en una sesión, y desglose por tipo. */
export interface DrinkTally {
  total: number
  byType: Map<string, number>
}

export function tallyByEntry(counts: DrinkCount[]): Map<string, DrinkTally> {
  const out = new Map<string, DrinkTally>()
  for (const c of counts) {
    const t = out.get(c.entryId) ?? { total: 0, byType: new Map() }
    t.total += c.count
    t.byType.set(c.typeId, (t.byType.get(c.typeId) ?? 0) + c.count)
    out.set(c.entryId, t)
  }
  return out
}

export interface DrinkPersonStats {
  personId: string
  sessions: number
  total: number
  average: number
  best: number
  byType: Map<string, number>
}

export function drinkStatsByPerson(entries: DrinkEntry[], counts: DrinkCount[]): Map<string, DrinkPersonStats> {
  const tallies = tallyByEntry(counts)
  const out = new Map<string, DrinkPersonStats>()
  for (const e of entries) {
    const s = out.get(e.personId) ?? {
      personId: e.personId,
      sessions: 0,
      total: 0,
      average: 0,
      best: 0,
      byType: new Map<string, number>(),
    }
    const t = tallies.get(e.id)
    s.sessions++
    s.total += t?.total ?? 0
    s.best = Math.max(s.best, t?.total ?? 0)
    for (const [type, n] of t?.byType ?? []) s.byType.set(type, (s.byType.get(type) ?? 0) + n)
    out.set(e.personId, s)
  }
  for (const s of out.values()) s.average = s.sessions ? s.total / s.sessions : 0
  return out
}

export interface DrinkSessionSummary {
  session: DrinkSession
  attendees: number
  total: number
  winners: string[]
  top: number
}

export function summarizeDrinkSessions(
  sessions: DrinkSession[],
  entries: DrinkEntry[],
  counts: DrinkCount[],
): DrinkSessionSummary[] {
  const tallies = tallyByEntry(counts)
  const bySession = new Map<string, DrinkEntry[]>()
  for (const e of entries) {
    const list = bySession.get(e.sessionId) ?? []
    list.push(e)
    bySession.set(e.sessionId, list)
  }
  return [...sessions]
    .sort((a, b) => b.date - a.date)
    .map((session) => {
      const list = bySession.get(session.id) ?? []
      const totals = list.map((e) => ({ personId: e.personId, n: tallies.get(e.id)?.total ?? 0 }))
      const top = totals.reduce((m, t) => Math.max(m, t.n), 0)
      return {
        session,
        attendees: list.length,
        total: totals.reduce((s, t) => s + t.n, 0),
        winners: top > 0 ? totals.filter((t) => t.n === top).map((t) => t.personId) : [],
        top,
      }
    })
}
