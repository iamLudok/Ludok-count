// Partidas de mus: siempre por parejas fijas (2 contra 2). Sin imports
// nativos: se prueba en `verify/library.ts`.
import { eq, sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { getDb } from './dbRef'
import { newId } from './ids'
import * as S from './schema'
import type { MusMatch } from '../types'

/** Lo habitual en la cuadrilla; se puede cambiar en cada partida. */
export const DEFAULT_MUS_TARGET = 40

export interface MusMatchInput {
  date?: number
  target: number
  team1: [string, string]
  team2: [string, string]
  note?: string
}

const clean = (s?: string) => (s?.trim() ? s.trim() : null)

/** Cuatro jugadores distintos, dos por equipo, y una meta de piedras razonable. */
function validate(input: MusMatchInput): void {
  const all = [...input.team1, ...input.team2]
  if (new Set(all).size !== 4) throw new Error('Hacen falta cuatro personas distintas, dos por pareja.')
  if (!Number.isInteger(input.target) || input.target < 1) {
    throw new Error('Las piedras para ganar tienen que ser un número entero mayor que 0.')
  }
}

export async function createMusMatch(input: MusMatchInput): Promise<string> {
  validate(input)
  const id = newId()
  const now = Date.now()
  await getDb().insert(S.musMatches).values({
    id,
    date: input.date ?? now,
    target: input.target,
    team1Player1: input.team1[0],
    team1Player2: input.team1[1],
    team2Player1: input.team2[0],
    team2Player2: input.team2[1],
    team1Score: 0,
    team2Score: 0,
    winner: null,
    note: clean(input.note),
    createdAt: now,
    finishedAt: null,
  })
  return id
}

export interface MusMatchMetaInput {
  date?: number
  target?: number
  note?: string
}

/** Cambia fecha, meta de piedras o nota. Las parejas no se tocan una vez creada la partida. */
export async function updateMusMatch(id: string, input: MusMatchMetaInput): Promise<void> {
  if (input.target !== undefined && (!Number.isInteger(input.target) || input.target < 1)) {
    throw new Error('Las piedras para ganar tienen que ser un número entero mayor que 0.')
  }
  const patch: Record<string, unknown> = {}
  if (input.date !== undefined) patch.date = input.date
  if (input.target !== undefined) patch.target = input.target
  if ('note' in input) patch.note = clean(input.note)
  if (Object.keys(patch).length) {
    await getDb().update(S.musMatches).set(patch).where(eq(S.musMatches.id, id))
  }
}

export async function deleteMusMatch(id: string): Promise<void> {
  await getDb().delete(S.musMatches).where(eq(S.musMatches.id, id))
}

/** Si alguno de los dos ya llega a la meta y todavía no hay ganador, se cierra la partida. */
/**
 * Construye, para el equipo que se está tocando, las expresiones SQL de
 * `winner` y `finishedAt` a partir de su nueva puntuación (`mine`, ya en SQL,
 * antes de escribirla) y la del otro equipo (`theirs`, la columna tal cual).
 *
 * Todo en una sola sentencia `UPDATE`, sin transacción ni lectura previa:
 * dentro de un mismo `UPDATE`, cada expresión ve siempre los valores DE ANTES
 * de la fila, así que repetir `mine` en varias columnas es seguro. Una
 * transacción con lectura-y-luego-escritura sonaba más clara, pero con varios
 * «+1» seguidos (toques rápidos en la mesa) cada una competía por el mismo
 * candado y saltaba `SQLITE_BUSY`; una sola sentencia no tiene ese problema.
 */
function finishExprs(mine: ReturnType<typeof sql>, theirs: AnySQLiteColumn, myTeam: 1 | 2) {
  const reached = sql`(${mine} >= ${S.musMatches.target} OR ${theirs} >= ${S.musMatches.target})`
  const winner = sql`CASE
    WHEN ${S.musMatches.winner} IS NOT NULL THEN ${S.musMatches.winner}
    WHEN ${reached} THEN CASE WHEN ${mine} >= ${theirs} THEN ${myTeam} ELSE ${myTeam === 1 ? 2 : 1} END
    ELSE NULL
  END`
  const finishedAt = sql`CASE
    WHEN ${S.musMatches.winner} IS NOT NULL THEN ${S.musMatches.finishedAt}
    WHEN ${reached} THEN ${Date.now()}
    ELSE ${S.musMatches.finishedAt}
  END`
  return { winner, finishedAt }
}

/**
 * Suma una piedra (o la resta, para corregir un toque de más). No hace nada
 * si la partida ya está cerrada: hay que reabrirla primero.
 */
export async function addMusPoint(matchId: string, team: 1 | 2, delta: number): Promise<void> {
  const col = team === 1 ? S.musMatches.team1Score : S.musMatches.team2Score
  const other = team === 1 ? S.musMatches.team2Score : S.musMatches.team1Score
  const d = Math.trunc(delta)
  // Solo cambia mientras no haya ganador: cerrada, un «+1» de más no debe colarse.
  const mine = sql`(CASE WHEN ${S.musMatches.winner} IS NULL THEN max(0, ${col} + ${d}) ELSE ${col} END)`
  const { winner, finishedAt } = finishExprs(mine, other, team)
  await getDb()
    .update(S.musMatches)
    .set({ [team === 1 ? 'team1Score' : 'team2Score']: mine, winner, finishedAt })
    .where(eq(S.musMatches.id, matchId))
}

/**
 * Corrige el marcador a mano. Se aplica SIEMPRE, incluso con la partida ya
 * cerrada (para arreglar un resultado final mal apuntado sin tener que
 * reabrirla). Si con el número nuevo se llega a la meta y todavía no había
 * ganador, la partida se cierra sola; si ya lo había, no se toca.
 */
export async function setMusScore(matchId: string, team: 1 | 2, score: number): Promise<void> {
  const other = team === 1 ? S.musMatches.team2Score : S.musMatches.team1Score
  const n = Number.isFinite(score) ? Math.max(0, Math.trunc(score)) : 0
  const { winner, finishedAt } = finishExprs(sql`${n}`, other, team)
  await getDb()
    .update(S.musMatches)
    .set({ [team === 1 ? 'team1Score' : 'team2Score']: n, winner, finishedAt })
    .where(eq(S.musMatches.id, matchId))
}

/**
 * Deshace el cierre de una partida (se dio a un toque de más, o se cerró por
 * error al corregir el marcador). Los tantos no se tocan.
 */
export async function reopenMusMatch(id: string): Promise<void> {
  await getDb().update(S.musMatches).set({ winner: null, finishedAt: null }).where(eq(S.musMatches.id, id))
}

/* --- Estadísticas (puras) -------------------------------------------------- */

export interface MusPersonStats {
  personId: string
  /** Solo cuentan las partidas cerradas: una en juego no es ni victoria ni derrota. */
  matches: number
  wins: number
  losses: number
  winRate: number
}

export function musStatsByPerson(matches: MusMatch[]): Map<string, MusPersonStats> {
  const out = new Map<string, MusPersonStats>()
  const bump = (personId: string, won: boolean) => {
    const s = out.get(personId) ?? { personId, matches: 0, wins: 0, losses: 0, winRate: 0 }
    s.matches++
    if (won) s.wins++
    else s.losses++
    out.set(personId, s)
  }
  for (const m of matches) {
    if (!m.winner) continue
    bump(m.team1Player1, m.winner === 1)
    bump(m.team1Player2, m.winner === 1)
    bump(m.team2Player1, m.winner === 2)
    bump(m.team2Player2, m.winner === 2)
  }
  for (const s of out.values()) s.winRate = s.matches ? s.wins / s.matches : 0
  return out
}

/** Las que siguen en juego (sin ganador todavía), la más reciente primero. */
export function ongoingMusMatches(matches: MusMatch[]): MusMatch[] {
  return matches.filter((m) => !m.winner).sort((a, b) => b.createdAt - a.createdAt)
}

/** Ya cerradas, la más reciente primero. */
export function finishedMusMatches(matches: MusMatch[]): MusMatch[] {
  return matches.filter((m) => m.winner).sort((a, b) => (b.finishedAt ?? b.date) - (a.finishedAt ?? a.date))
}
