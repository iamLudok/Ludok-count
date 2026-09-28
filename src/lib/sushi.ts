// Sesiones de buffet de sushi: quién fue y cuántos trozos se comió cada uno.
// Sin imports nativos: se prueba en `verify/library.ts`.
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from './dbRef'
import { newId } from './ids'
import * as S from './schema'
import type { AppDb } from './backupCore'
import type { SushiEntry, SushiSession } from '../types'

export interface SessionInput {
  date?: number
  place?: string
  note?: string
}

const clean = (s?: string) => (s?.trim() ? s.trim() : null)

/** Crea la sesión ya con quienes han ido. Devuelve su id. */
export async function createSushiSession(input: SessionInput, personIds: string[]): Promise<string> {
  const id = newId()
  const now = Date.now()
  await getDb().transaction(async (tx: AppDb) => {
    await tx.insert(S.sushiSessions).values({
      id,
      date: input.date ?? now,
      place: clean(input.place),
      note: clean(input.note),
      createdAt: now,
    })
    const unique = [...new Set(personIds)]
    if (unique.length) {
      await tx
        .insert(S.sushiEntries)
        .values(unique.map((personId) => ({ id: newId(), sessionId: id, personId, pieces: 0 })))
    }
  })
  return id
}

export async function updateSushiSession(id: string, input: SessionInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.date !== undefined) patch.date = input.date
  if ('place' in input) patch.place = clean(input.place)
  if ('note' in input) patch.note = clean(input.note)
  if (Object.keys(patch).length) {
    await getDb().update(S.sushiSessions).set(patch).where(eq(S.sushiSessions.id, id))
  }
}

/** Borra la sesión y lo que comió cada uno en ella. */
export async function deleteSushiSession(id: string): Promise<void> {
  await getDb().transaction(async (tx: AppDb) => {
    await tx.delete(S.sushiEntries).where(eq(S.sushiEntries.sessionId, id))
    await tx.delete(S.sushiSessions).where(eq(S.sushiSessions.id, id))
  })
}

/**
 * Apunta a alguien que llega tarde. Si ya estaba no hace nada: el índice único
 * lo impediría igual, pero un doble toque no tiene por qué acabar en error.
 */
export async function addSushiAttendee(sessionId: string, personId: string): Promise<void> {
  await getDb()
    .insert(S.sushiEntries)
    .values({ id: newId(), sessionId, personId, pieces: 0 })
    .onConflictDoNothing()
}

export async function removeSushiAttendee(sessionId: string, personId: string): Promise<void> {
  await getDb()
    .delete(S.sushiEntries)
    .where(and(eq(S.sushiEntries.sessionId, sessionId), eq(S.sushiEntries.personId, personId)))
}

/**
 * Suma (o resta) trozos. Se hace en SQL y no leyendo-sumando-escribiendo: al
 * machacar el botón varias veces seguidas, dos lecturas del mismo valor
 * pisaban una suma y se perdían trozos. Nunca baja de 0.
 */
export async function addPieces(entryId: string, delta: number): Promise<void> {
  await getDb()
    .update(S.sushiEntries)
    .set({ pieces: sql`max(0, ${S.sushiEntries.pieces} + ${Math.trunc(delta)})` })
    .where(eq(S.sushiEntries.id, entryId))
}

/** Pone un número exacto (para corregir a mano). */
export async function setPieces(entryId: string, pieces: number): Promise<void> {
  const n = Number.isFinite(pieces) ? Math.max(0, Math.trunc(pieces)) : 0
  await getDb().update(S.sushiEntries).set({ pieces: n }).where(eq(S.sushiEntries.id, entryId))
}

/* --- Estadísticas (puras: reciben los datos, no tocan la base) ------------ */

export interface SushiPersonStats {
  personId: string
  /** Sesiones a las que fue. */
  sessions: number
  total: number
  /** Media por sesión a la que FUE: no ir no le baja la media. */
  average: number
  best: number
  bestSessionId?: string
}

export function sushiStatsByPerson(entries: SushiEntry[]): Map<string, SushiPersonStats> {
  const out = new Map<string, SushiPersonStats>()
  for (const e of entries) {
    const s = out.get(e.personId) ?? { personId: e.personId, sessions: 0, total: 0, average: 0, best: 0 }
    s.sessions++
    s.total += e.pieces
    if (e.pieces > s.best) {
      s.best = e.pieces
      s.bestSessionId = e.sessionId
    }
    out.set(e.personId, s)
  }
  for (const s of out.values()) s.average = s.sessions ? s.total / s.sessions : 0
  return out
}

export interface SushiSessionSummary {
  session: SushiSession
  attendees: number
  total: number
  /** Quién más comió (puede haber empate). */
  winners: string[]
  top: number
}

export function summarizeSushiSessions(sessions: SushiSession[], entries: SushiEntry[]): SushiSessionSummary[] {
  const bySession = new Map<string, SushiEntry[]>()
  for (const e of entries) {
    const list = bySession.get(e.sessionId) ?? []
    list.push(e)
    bySession.set(e.sessionId, list)
  }
  return [...sessions]
    .sort((a, b) => b.date - a.date)
    .map((session) => {
      const list = bySession.get(session.id) ?? []
      const top = list.reduce((m, e) => Math.max(m, e.pieces), 0)
      return {
        session,
        attendees: list.length,
        total: list.reduce((sum, e) => sum + e.pieces, 0),
        winners: top > 0 ? list.filter((e) => e.pieces === top).map((e) => e.personId) : [],
        top,
      }
    })
}

/** El récord absoluto: más trozos en una sola sesión. */
export function sushiRecord(entries: SushiEntry[]): SushiEntry | undefined {
  let best: SushiEntry | undefined
  for (const e of entries) if (e.pieces > 0 && (!best || e.pieces > best.pieces)) best = e
  return best
}
