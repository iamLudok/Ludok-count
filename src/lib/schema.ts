// Definición de tablas para Drizzle. Solo describe las columnas: las tablas y
// los índices se crean con SQL explícito (`schemaSql.ts`), con migraciones por
// PRAGMA user_version.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { ExpenseKind, SplitMode, ThemePref } from '../types'

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  addedAt: integer('addedAt').notNull(),
  archivedAt: integer('archivedAt'),
})

export const sushiSessions = sqliteTable('sushi_sessions', {
  id: text('id').primaryKey(),
  date: integer('date').notNull(),
  place: text('place'),
  note: text('note'),
  createdAt: integer('createdAt').notNull(),
})

export const sushiEntries = sqliteTable('sushi_entries', {
  id: text('id').primaryKey(),
  sessionId: text('sessionId').notNull(),
  personId: text('personId').notNull(),
  pieces: integer('pieces').notNull().default(0),
})

export const drinkTypes = sqliteTable('drink_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sortOrder').notNull().default(0),
  archivedAt: integer('archivedAt'),
})

export const drinkSessions = sqliteTable('drink_sessions', {
  id: text('id').primaryKey(),
  date: integer('date').notNull(),
  title: text('title'),
  place: text('place'),
  note: text('note'),
  createdAt: integer('createdAt').notNull(),
})

export const drinkEntries = sqliteTable('drink_entries', {
  id: text('id').primaryKey(),
  sessionId: text('sessionId').notNull(),
  personId: text('personId').notNull(),
})

export const drinkCounts = sqliteTable('drink_counts', {
  id: text('id').primaryKey(),
  entryId: text('entryId').notNull(),
  typeId: text('typeId').notNull(),
  count: integer('count').notNull().default(0),
})

export const expenseGroups = sqliteTable('expense_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('createdAt').notNull(),
  archivedAt: integer('archivedAt'),
})

export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('groupId').notNull(),
  personId: text('personId').notNull(),
})

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  groupId: text('groupId').notNull(),
  kind: text('kind').$type<ExpenseKind>().notNull(),
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  paidBy: text('paidBy').notNull(),
  date: integer('date').notNull(),
  splitMode: text('splitMode').$type<SplitMode>().notNull(),
  createdAt: integer('createdAt').notNull(),
})

export const expenseShares = sqliteTable('expense_shares', {
  id: text('id').primaryKey(),
  expenseId: text('expenseId').notNull(),
  personId: text('personId').notNull(),
  weight: integer('weight').notNull(),
  amount: integer('amount').notNull(),
})

export const musMatches = sqliteTable('mus_matches', {
  id: text('id').primaryKey(),
  date: integer('date').notNull(),
  target: integer('target').notNull().default(40),
  team1Player1: text('team1Player1').notNull(),
  team1Player2: text('team1Player2').notNull(),
  team2Player1: text('team2Player1').notNull(),
  team2Player2: text('team2Player2').notNull(),
  team1Score: integer('team1Score').notNull().default(0),
  team2Score: integer('team2Score').notNull().default(0),
  winner: integer('winner'),
  note: text('note'),
  createdAt: integer('createdAt').notNull(),
  finishedAt: integer('finishedAt'),
})

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  theme: text('theme').$type<ThemePref>().notNull().default('system'),
  lastBackup: integer('lastBackup').notNull().default(0),
  onboardedAt: integer('onboardedAt'),
  mePersonId: text('mePersonId'),
  nextcloudUrl: text('nextcloudUrl'),
  nextcloudUser: text('nextcloudUser'),
  nextcloudPassword: text('nextcloudPassword'),
  nextcloudFolder: text('nextcloudFolder'),
  autoBackup: integer('autoBackup', { mode: 'boolean' }),
  lastAutoBackupAt: integer('lastAutoBackupAt'),
  schemaVersion: integer('schemaVersion').notNull(),
})

export type PersonRow = typeof people.$inferSelect
export type SushiSessionRow = typeof sushiSessions.$inferSelect
export type SushiEntryRow = typeof sushiEntries.$inferSelect
export type DrinkTypeRow = typeof drinkTypes.$inferSelect
export type DrinkSessionRow = typeof drinkSessions.$inferSelect
export type DrinkEntryRow = typeof drinkEntries.$inferSelect
export type DrinkCountRow = typeof drinkCounts.$inferSelect
export type ExpenseGroupRow = typeof expenseGroups.$inferSelect
export type GroupMemberRow = typeof groupMembers.$inferSelect
export type ExpenseRow = typeof expenses.$inferSelect
export type ExpenseShareRow = typeof expenseShares.$inferSelect
export type MusMatchRow = typeof musMatches.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
