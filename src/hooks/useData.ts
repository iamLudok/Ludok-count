import { useMemo } from 'react'
import { eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { db } from '../lib/db'
import * as S from '../lib/schema'
import * as R from '../lib/rows'
import { byName } from '../lib/people'
import type {
  Person,
  SushiSession,
  SushiEntry,
  DrinkType,
  DrinkSession,
  DrinkEntry,
  DrinkCount,
  ExpenseGroup,
  GroupMember,
  Expense,
  ExpenseShare,
  MusMatch,
} from '../types'

/**
 * Consultas reactivas. Se leen las tablas enteras y se filtra en memoria: una
 * cuadrilla genera cientos de filas en años, no millones, y así cada pantalla
 * tiene todo lo que necesita para sus estadísticas sin consultas a medida.
 *
 * ⚠️ `useLiveQuery` de Drizzle arranca con `data = []` y lanza la consulta en un
 * efecto, así que en el primer render «sin filas» es indistinguible de
 * «todavía no ha respondido». `updatedAt` es lo que de verdad indica que ya
 * hay respuesta: sin mirarlo, una sesión recién creada aparecía como «No
 * encontrada» durante un instante al abrirla.
 */
export interface Query<T> {
  data: T
  /** false hasta que la consulta ha devuelto algo por primera vez. */
  ready: boolean
}

function useTable<Row, T>(query: Parameters<typeof useLiveQuery>[0], map: (r: Row) => T): Query<T[]> {
  const { data, updatedAt } = useLiveQuery(query)
  const mapped = useMemo(() => ((data ?? []) as Row[]).map(map), [data, map])
  return { data: mapped, ready: updatedAt !== undefined }
}

/** Toda la gente, en orden alfabético (archivados incluidos: su historial cuenta). */
export function usePeople(): Query<Person[]> {
  const q = useTable(db.select().from(S.people), R.rowToPerson)
  const data = useMemo(() => [...q.data].sort(byName), [q.data])
  return { data, ready: q.ready }
}

/** Nombre por id, para pintar listas sin buscar cada vez. */
export function usePeopleById(): Map<string, Person> {
  const { data } = usePeople()
  return useMemo(() => new Map(data.map((p) => [p.id, p])), [data])
}

export function useSushi(): Query<{ sessions: SushiSession[]; entries: SushiEntry[] }> {
  const sessions = useTable(db.select().from(S.sushiSessions), R.rowToSushiSession)
  const entries = useTable(db.select().from(S.sushiEntries), R.rowToSushiEntry)
  const data = useMemo(() => ({ sessions: sessions.data, entries: entries.data }), [sessions.data, entries.data])
  return { data, ready: sessions.ready && entries.ready }
}

export function useDrinkTypes(): Query<DrinkType[]> {
  const q = useTable(db.select().from(S.drinkTypes), R.rowToDrinkType)
  const data = useMemo(() => [...q.data].sort((a, b) => a.sortOrder - b.sortOrder), [q.data])
  return { data, ready: q.ready }
}

export function useDrinks(): Query<{ sessions: DrinkSession[]; entries: DrinkEntry[]; counts: DrinkCount[] }> {
  const sessions = useTable(db.select().from(S.drinkSessions), R.rowToDrinkSession)
  const entries = useTable(db.select().from(S.drinkEntries), R.rowToDrinkEntry)
  const counts = useTable(db.select().from(S.drinkCounts), R.rowToDrinkCount)
  const data = useMemo(
    () => ({ sessions: sessions.data, entries: entries.data, counts: counts.data }),
    [sessions.data, entries.data, counts.data],
  )
  return { data, ready: sessions.ready && entries.ready && counts.ready }
}

export interface ExpensesData {
  groups: ExpenseGroup[]
  members: GroupMember[]
  expenses: Expense[]
  shares: ExpenseShare[]
}

export function useExpenses(): Query<ExpensesData> {
  const groups = useTable(db.select().from(S.expenseGroups), R.rowToGroup)
  const members = useTable(db.select().from(S.groupMembers), R.rowToGroupMember)
  const expenses = useTable(db.select().from(S.expenses), R.rowToExpense)
  const shares = useTable(db.select().from(S.expenseShares), R.rowToShare)
  const data = useMemo(
    () => ({ groups: groups.data, members: members.data, expenses: expenses.data, shares: shares.data }),
    [groups.data, members.data, expenses.data, shares.data],
  )
  return { data, ready: groups.ready && members.ready && expenses.ready && shares.ready }
}

/** Un grupo con lo suyo ya filtrado. `group` es null si no existe (borrado). */
export function useGroup(groupId: string | undefined): Query<{
  group: ExpenseGroup | null
  memberIds: string[]
  expenses: Expense[]
  shares: ExpenseShare[]
}> {
  const all = useExpenses()
  const data = useMemo(() => {
    const expenses = all.data.expenses.filter((e) => e.groupId === groupId)
    const ids = new Set(expenses.map((e) => e.id))
    return {
      group: all.data.groups.find((g) => g.id === groupId) ?? null,
      memberIds: all.data.members.filter((m) => m.groupId === groupId).map((m) => m.personId),
      expenses: expenses.sort((a, b) => b.date - a.date || b.createdAt - a.createdAt),
      shares: all.data.shares.filter((s) => ids.has(s.expenseId)),
    }
  }, [all.data, groupId])
  return { data, ready: all.ready }
}

/** Todas las partidas de mus, en juego y cerradas. */
export function useMus(): Query<MusMatch[]> {
  return useTable(db.select().from(S.musMatches), R.rowToMusMatch)
}

/** Una sola fila de una tabla por id (para fichas). */
export function useSushiSession(id: string | undefined): SushiSession | null | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(S.sushiSessions).where(eq(S.sushiSessions.id, id ?? '')),
    [id],
  )
  if (!id) return null
  if (updatedAt === undefined) return undefined
  return data[0] ? R.rowToSushiSession(data[0]) : null
}

export function useDrinkSession(id: string | undefined): DrinkSession | null | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(S.drinkSessions).where(eq(S.drinkSessions.id, id ?? '')),
    [id],
  )
  if (!id) return null
  if (updatedAt === undefined) return undefined
  return data[0] ? R.rowToDrinkSession(data[0]) : null
}

export function useMusMatch(id: string | undefined): MusMatch | null | undefined {
  const { data, updatedAt } = useLiveQuery(db.select().from(S.musMatches).where(eq(S.musMatches.id, id ?? '')), [id])
  if (!id) return null
  if (updatedAt === undefined) return undefined
  return data[0] ? R.rowToMusMatch(data[0]) : null
}
