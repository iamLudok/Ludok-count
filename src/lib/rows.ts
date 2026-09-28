// Traducción entre las filas de SQLite y el modelo de dominio.
//
// SQLite devuelve `null` en las columnas vacías, pero los tipos de la app (y el
// formato de las copias) usan `undefined`, que `JSON.stringify` elimina. Pasar
// de uno a otro explícitamente es lo que mantiene los ficheros de copia con la
// misma forma exacta, sin `null` sueltos.
import { SCHEMA_VERSION } from './version'
import type * as S from './schema'
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
  Settings,
} from '../types'

/** null → undefined */
const u = <T>(v: T | null): T | undefined => (v === null ? undefined : v)
/** undefined → null */
const n = <T>(v: T | undefined): T | null => (v === undefined ? null : v)

export const rowToPerson = (r: S.PersonRow): Person => ({
  id: r.id,
  name: r.name,
  addedAt: r.addedAt,
  archivedAt: u(r.archivedAt),
})
export const personToRow = (p: Person): S.PersonRow => ({
  id: p.id,
  name: p.name,
  addedAt: p.addedAt,
  archivedAt: n(p.archivedAt),
})

export const rowToSushiSession = (r: S.SushiSessionRow): SushiSession => ({
  id: r.id,
  date: r.date,
  place: u(r.place),
  note: u(r.note),
  createdAt: r.createdAt,
})
export const sushiSessionToRow = (s: SushiSession): S.SushiSessionRow => ({
  id: s.id,
  date: s.date,
  place: n(s.place),
  note: n(s.note),
  createdAt: s.createdAt,
})

// Las tablas sin columnas opcionales son iguales en los dos lados; aun así
// pasan por aquí para que añadir un campo opcional tenga un único sitio donde
// tocar, igual que las demás.
export const rowToSushiEntry = (r: S.SushiEntryRow): SushiEntry => ({ ...r })
export const sushiEntryToRow = (e: SushiEntry): S.SushiEntryRow => ({
  id: e.id,
  sessionId: e.sessionId,
  personId: e.personId,
  pieces: e.pieces ?? 0,
})

export const rowToDrinkType = (r: S.DrinkTypeRow): DrinkType => ({
  id: r.id,
  name: r.name,
  sortOrder: r.sortOrder,
  archivedAt: u(r.archivedAt),
})
export const drinkTypeToRow = (t: DrinkType): S.DrinkTypeRow => ({
  id: t.id,
  name: t.name,
  sortOrder: t.sortOrder ?? 0,
  archivedAt: n(t.archivedAt),
})

export const rowToDrinkSession = (r: S.DrinkSessionRow): DrinkSession => ({
  id: r.id,
  date: r.date,
  title: u(r.title),
  place: u(r.place),
  note: u(r.note),
  createdAt: r.createdAt,
})
export const drinkSessionToRow = (s: DrinkSession): S.DrinkSessionRow => ({
  id: s.id,
  date: s.date,
  title: n(s.title),
  place: n(s.place),
  note: n(s.note),
  createdAt: s.createdAt,
})

export const rowToDrinkEntry = (r: S.DrinkEntryRow): DrinkEntry => ({ ...r })
export const drinkEntryToRow = (e: DrinkEntry): S.DrinkEntryRow => ({
  id: e.id,
  sessionId: e.sessionId,
  personId: e.personId,
})

export const rowToDrinkCount = (r: S.DrinkCountRow): DrinkCount => ({ ...r })
export const drinkCountToRow = (c: DrinkCount): S.DrinkCountRow => ({
  id: c.id,
  entryId: c.entryId,
  typeId: c.typeId,
  count: c.count ?? 0,
})

export const rowToGroup = (r: S.ExpenseGroupRow): ExpenseGroup => ({
  id: r.id,
  name: r.name,
  createdAt: r.createdAt,
  archivedAt: u(r.archivedAt),
})
export const groupToRow = (g: ExpenseGroup): S.ExpenseGroupRow => ({
  id: g.id,
  name: g.name,
  createdAt: g.createdAt,
  archivedAt: n(g.archivedAt),
})

export const rowToGroupMember = (r: S.GroupMemberRow): GroupMember => ({ ...r })
export const groupMemberToRow = (m: GroupMember): S.GroupMemberRow => ({
  id: m.id,
  groupId: m.groupId,
  personId: m.personId,
})

export const rowToExpense = (r: S.ExpenseRow): Expense => ({ ...r })
export const expenseToRow = (e: Expense): S.ExpenseRow => ({
  id: e.id,
  groupId: e.groupId,
  kind: e.kind,
  title: e.title,
  amount: e.amount,
  paidBy: e.paidBy,
  date: e.date,
  splitMode: e.splitMode,
  createdAt: e.createdAt,
})

export const rowToShare = (r: S.ExpenseShareRow): ExpenseShare => ({ ...r })
export const shareToRow = (s: ExpenseShare): S.ExpenseShareRow => ({
  id: s.id,
  expenseId: s.expenseId,
  personId: s.personId,
  weight: s.weight,
  amount: s.amount,
})

export const rowToSettings = (r: S.SettingsRow): Settings => ({
  id: 'app',
  theme: r.theme,
  lastBackup: r.lastBackup,
  onboardedAt: u(r.onboardedAt),
  nextcloudUrl: u(r.nextcloudUrl),
  nextcloudUser: u(r.nextcloudUser),
  nextcloudPassword: u(r.nextcloudPassword),
  nextcloudFolder: u(r.nextcloudFolder),
  autoBackup: u(r.autoBackup),
  lastAutoBackupAt: u(r.lastAutoBackupAt),
  schemaVersion: r.schemaVersion,
})
export const settingsToRow = (s: Settings): S.SettingsRow => ({
  id: 'app',
  theme: s.theme,
  lastBackup: s.lastBackup,
  onboardedAt: n(s.onboardedAt),
  nextcloudUrl: n(s.nextcloudUrl),
  nextcloudUser: n(s.nextcloudUser),
  nextcloudPassword: n(s.nextcloudPassword),
  nextcloudFolder: n(s.nextcloudFolder),
  autoBackup: n(s.autoBackup),
  lastAutoBackupAt: n(s.lastAutoBackupAt),
  schemaVersion: s.schemaVersion ?? SCHEMA_VERSION,
})
