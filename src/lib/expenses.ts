// Gastos compartidos, al estilo Tricount: grupos, gastos, repartos y quién le
// debe a quién. Sin imports nativos: se prueba en `verify/library.ts`.
import { eq, inArray } from 'drizzle-orm'
import { getDb } from './dbRef'
import { newId } from './ids'
import * as S from './schema'
import { rowToExpense, rowToShare } from './rows'
import { splitByWeights } from './money'
import type { AppDb } from './backupCore'
import type { Expense, ExpenseShare, SplitMode } from '../types'

/* --- Grupos --------------------------------------------------------------- */

function cleanGroupName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Ponle un nombre al grupo.')
  if (clean.length > 40) throw new Error('Nombre demasiado largo (máximo 40 caracteres).')
  return clean
}

export async function createGroup(name: string, personIds: string[]): Promise<string> {
  const clean = cleanGroupName(name)
  const members = [...new Set(personIds)]
  if (members.length < 2) throw new Error('Un grupo de gastos necesita al menos dos personas.')
  const id = newId()
  await getDb().transaction(async (tx: AppDb) => {
    await tx.insert(S.expenseGroups).values({ id, name: clean, createdAt: Date.now(), archivedAt: null })
    await tx.insert(S.groupMembers).values(members.map((personId) => ({ id: newId(), groupId: id, personId })))
  })
  return id
}

export async function renameGroup(id: string, name: string): Promise<void> {
  await getDb().update(S.expenseGroups).set({ name: cleanGroupName(name) }).where(eq(S.expenseGroups.id, id))
}

export async function setGroupArchived(id: string, archived: boolean): Promise<void> {
  await getDb()
    .update(S.expenseGroups)
    .set({ archivedAt: archived ? Date.now() : null })
    .where(eq(S.expenseGroups.id, id))
}

/** Borra el grupo con todos sus gastos, repartos y miembros. */
export async function deleteGroup(id: string): Promise<void> {
  await getDb().transaction(async (tx: AppDb) => {
    const exp = await tx.select({ id: S.expenses.id }).from(S.expenses).where(eq(S.expenses.groupId, id))
    const ids = exp.map((e: { id: string }) => e.id)
    if (ids.length) await tx.delete(S.expenseShares).where(inArray(S.expenseShares.expenseId, ids))
    await tx.delete(S.expenses).where(eq(S.expenses.groupId, id))
    await tx.delete(S.groupMembers).where(eq(S.groupMembers.groupId, id))
    await tx.delete(S.expenseGroups).where(eq(S.expenseGroups.id, id))
  })
}

/** Quién aparece en algún gasto del grupo (pagando o en el reparto). */
async function involvedIn(tx: AppDb, groupId: string): Promise<Set<string>> {
  const exps = (await tx.select().from(S.expenses).where(eq(S.expenses.groupId, groupId))) as Expense[]
  const out = new Set(exps.map((e) => e.paidBy))
  if (exps.length) {
    const shares = (await tx
      .select()
      .from(S.expenseShares)
      .where(inArray(S.expenseShares.expenseId, exps.map((e) => e.id)))) as ExpenseShare[]
    for (const s of shares) out.add(s.personId)
  }
  return out
}

/**
 * Cambia quién está en el grupo. A quien ya sale en algún gasto NO se le
 * quita: sus gastos seguirían contando en el balance, pero ya no se le vería
 * en la lista de saldos y la deuda quedaría huérfana. Devuelve los ids que se
 * quedaron por ese motivo, para poder decírselo al usuario.
 */
export async function setGroupMembers(groupId: string, personIds: string[]): Promise<{ kept: string[] }> {
  const wanted = new Set(personIds)
  const kept: string[] = []
  await getDb().transaction(async (tx: AppDb) => {
    const current = (await tx.select().from(S.groupMembers).where(eq(S.groupMembers.groupId, groupId))) as {
      id: string
      personId: string
    }[]
    const involved = await involvedIn(tx, groupId)
    for (const m of current) {
      if (wanted.has(m.personId)) continue
      if (involved.has(m.personId)) kept.push(m.personId)
      else await tx.delete(S.groupMembers).where(eq(S.groupMembers.id, m.id))
    }
    const have = new Set(current.map((m) => m.personId))
    const toAdd = [...wanted].filter((p) => !have.has(p))
    if (toAdd.length) {
      await tx.insert(S.groupMembers).values(toAdd.map((personId) => ({ id: newId(), groupId, personId })))
    }
  })
  return { kept }
}

/* --- Gastos --------------------------------------------------------------- */

/** Una línea del reparto tal y como la rellena el formulario. */
export interface SplitPart {
  personId: string
  /**
   * `equal`: cualquier valor > 0 = entra en el reparto.
   * `shares`: número de partes.
   * `amounts`: céntimos exactos.
   */
  value: number
}

export interface ExpenseInput {
  groupId: string
  title: string
  /** Céntimos. */
  amount: number
  paidBy: string
  date?: number
  splitMode: SplitMode
  parts: SplitPart[]
}

/**
 * Convierte el formulario en repartos cuadrados al céntimo, o lanza un error
 * que se puede enseñar tal cual. Es pura: la validación se prueba sin base.
 */
export function buildShares(
  amount: number,
  mode: SplitMode,
  parts: SplitPart[],
  paidBy: string,
): { personId: string; weight: number; amount: number }[] {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('El importe tiene que ser mayor que 0.')
  const seen = new Set<string>()
  const active = parts.filter((p) => {
    if (seen.has(p.personId) || !(p.value > 0)) return false
    seen.add(p.personId)
    return true
  })
  if (!active.length) throw new Error('Elige al menos una persona para repartir.')

  if (mode === 'amounts') {
    if (active.some((p) => !Number.isSafeInteger(p.value))) throw new Error('Importes con más de dos decimales.')
    const sum = active.reduce((s, p) => s + p.value, 0)
    if (sum !== amount) {
      const diff = amount - sum
      throw new Error(
        diff > 0
          ? `Faltan ${(diff / 100).toFixed(2).replace('.', ',')} € por repartir.`
          : `Te pasas en ${(-diff / 100).toFixed(2).replace('.', ',')} €.`,
      )
    }
    return active.map((p) => ({ personId: p.personId, weight: p.value, amount: p.value }))
  }

  const weights = active.map((p) => (mode === 'equal' ? 1 : Math.trunc(p.value)))
  if (weights.some((w) => w < 1)) throw new Error('Las partes tienen que ser números enteros.')
  // El céntimo (o los pocos que sobren) se los queda quien pagó, no un
  // tercero al azar: es quien puso el dinero, y el resto no debe nunca menos
  // de su parte exacta redondeada hacia arriba.
  const favor = active.findIndex((p) => p.personId === paidBy)
  const amounts = splitByWeights(amount, weights, favor >= 0 ? favor : undefined)
  return active.map((p, i) => ({ personId: p.personId, weight: weights[i], amount: amounts[i] }))
}

function cleanTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Ponle un título al gasto.')
  return clean.slice(0, 80)
}

export async function addExpense(input: ExpenseInput): Promise<string> {
  const title = cleanTitle(input.title)
  const shares = buildShares(input.amount, input.splitMode, input.parts, input.paidBy)
  const id = newId()
  const now = Date.now()
  await getDb().transaction(async (tx: AppDb) => {
    await tx.insert(S.expenses).values({
      id,
      groupId: input.groupId,
      kind: 'expense',
      title,
      amount: input.amount,
      paidBy: input.paidBy,
      date: input.date ?? now,
      splitMode: input.splitMode,
      createdAt: now,
    })
    await tx.insert(S.expenseShares).values(shares.map((s) => ({ id: newId(), expenseId: id, ...s })))
  })
  return id
}

/** Edita un gasto: se reescriben sus repartos enteros, en la misma transacción. */
export async function updateExpense(id: string, input: Omit<ExpenseInput, 'groupId'>): Promise<void> {
  const title = cleanTitle(input.title)
  const shares = buildShares(input.amount, input.splitMode, input.parts, input.paidBy)
  await getDb().transaction(async (tx: AppDb) => {
    await tx
      .update(S.expenses)
      .set({
        title,
        amount: input.amount,
        paidBy: input.paidBy,
        ...(input.date !== undefined ? { date: input.date } : {}),
        splitMode: input.splitMode,
      })
      .where(eq(S.expenses.id, id))
    await tx.delete(S.expenseShares).where(eq(S.expenseShares.expenseId, id))
    await tx.insert(S.expenseShares).values(shares.map((s) => ({ id: newId(), expenseId: id, ...s })))
  })
}

export async function deleteExpense(id: string): Promise<void> {
  await getDb().transaction(async (tx: AppDb) => {
    await tx.delete(S.expenseShares).where(eq(S.expenseShares.expenseId, id))
    await tx.delete(S.expenses).where(eq(S.expenses.id, id))
  })
}

/**
 * Apunta que `from` le ha pagado `amount` a `to`. Es un gasto más: `from`
 * «paga» y a `to` le «toca» ese importe, con lo que el balance de los dos se
 * acerca a cero exactamente en esa cantidad.
 */
export async function addTransfer(
  groupId: string,
  from: string,
  to: string,
  amount: number,
  date?: number,
): Promise<string> {
  if (from === to) throw new Error('Alguien no puede pagarse a sí mismo.')
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('El importe tiene que ser mayor que 0.')
  const id = newId()
  const now = Date.now()
  await getDb().transaction(async (tx: AppDb) => {
    await tx.insert(S.expenses).values({
      id,
      groupId,
      kind: 'transfer',
      title: 'Reembolso',
      amount,
      paidBy: from,
      date: date ?? now,
      splitMode: 'amounts',
      createdAt: now,
    })
    await tx.insert(S.expenseShares).values({ id: newId(), expenseId: id, personId: to, weight: amount, amount })
  })
  return id
}

/** Gastos y repartos de un grupo, para las pruebas y para el balance fuera de React. */
export async function loadGroup(groupId: string): Promise<{ expenses: Expense[]; shares: ExpenseShare[] }> {
  const db = getDb()
  const expenses = (await db.select().from(S.expenses).where(eq(S.expenses.groupId, groupId))).map(rowToExpense)
  const shares = expenses.length
    ? (
        await db
          .select()
          .from(S.expenseShares)
          .where(inArray(S.expenseShares.expenseId, expenses.map((e) => e.id)))
      ).map(rowToShare)
    : []
  return { expenses, shares }
}

/* --- Balances (puros) ----------------------------------------------------- */

/**
 * Saldo de cada persona: lo que ha pagado menos lo que le tocaba. Positivo =
 * le deben; negativo = debe. La suma de todos es SIEMPRE 0, porque cada gasto
 * reparte exactamente su importe (lo garantiza `buildShares`).
 */
export function balances(expenses: Expense[], shares: ExpenseShare[]): Map<string, number> {
  const out = new Map<string, number>()
  const add = (p: string, v: number) => out.set(p, (out.get(p) ?? 0) + v)
  for (const e of expenses) add(e.paidBy, e.amount)
  for (const s of shares) add(s.personId, -s.amount)
  return out
}

export interface Settlement {
  from: string
  to: string
  amount: number
}

/**
 * Los pagos mínimos para dejar a todos a cero. Aquí está lo de «si A le debe a
 * B y B le debe a C, que A le pague directamente a C»: como se trabaja con el
 * saldo NETO de cada uno y no con las deudas sueltas, esas cadenas
 * desaparecen solas.
 *
 * 1. Primero se emparejan quienes deben y a quienes les deben exactamente lo
 *    mismo: un solo pago los deja a los dos a cero.
 * 2. Con lo que queda, el que más debe le paga al que más le deben, y así
 *    hasta acabar. Salen como mucho n−1 pagos. (El mínimo absoluto es un
 *    problema NP-difícil; con una cuadrilla, esto da lo mismo en la práctica.)
 *
 * Determinista (a igualdad, ordena por id): la lista no baila cada vez que se
 * abre la pantalla.
 */
export function settle(balance: Map<string, number>): Settlement[] {
  const debtors = [...balance].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }))
  const creditors = [...balance].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }))
  const byAmount = (a: { id: string; v: number }, b: { id: string; v: number }) =>
    b.v - a.v || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  debtors.sort(byAmount)
  creditors.sort(byAmount)

  const out: Settlement[] = []
  for (const d of debtors) {
    const c = creditors.find((c) => c.v === d.v)
    if (c) {
      out.push({ from: d.id, to: c.id, amount: d.v })
      d.v = 0
      c.v = 0
    }
  }

  const ds = debtors.filter((d) => d.v > 0)
  const cs = creditors.filter((c) => c.v > 0)
  while (ds.length && cs.length) {
    ds.sort(byAmount)
    cs.sort(byAmount)
    const d = ds[0]
    const c = cs[0]
    const amount = Math.min(d.v, c.v)
    out.push({ from: d.id, to: c.id, amount })
    d.v -= amount
    c.v -= amount
    if (d.v === 0) ds.shift()
    if (c.v === 0) cs.shift()
  }
  return out
}

export interface GroupTotals {
  /** Lo gastado de verdad (sin contar reembolsos). */
  spent: number
  /** Lo que ha pagado cada uno en gastos (sin reembolsos). */
  paidBy: Map<string, number>
  /** Lo que le ha tocado a cada uno en gastos (sin reembolsos). */
  consumed: Map<string, number>
}

export function groupTotals(expenses: Expense[], shares: ExpenseShare[]): GroupTotals {
  const real = new Set(expenses.filter((e) => e.kind === 'expense').map((e) => e.id))
  const paidBy = new Map<string, number>()
  const consumed = new Map<string, number>()
  let spent = 0
  for (const e of expenses) {
    if (!real.has(e.id)) continue
    spent += e.amount
    paidBy.set(e.paidBy, (paidBy.get(e.paidBy) ?? 0) + e.amount)
  }
  for (const s of shares) {
    if (!real.has(s.expenseId)) continue
    consumed.set(s.personId, (consumed.get(s.personId) ?? 0) + s.amount)
  }
  return { spent, paidBy, consumed }
}
