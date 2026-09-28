// Modelo de dominio de Ludok Count y forma del fichero de copia.
//
// Los campos ausentes son `undefined`, nunca `null`: `JSON.stringify` los quita
// y así el fichero de copia mantiene siempre la misma forma. La traducción desde
// las filas de SQLite (que sí devuelven `null`) vive en `lib/rows.ts`.

/** Alguien de la cuadrilla. */
export interface Person {
  id: string
  name: string
  addedAt: number
  /**
   * Quien deja de venir no se borra: su historial de sushi, copas y gastos
   * sigue contando. Archivado solo significa que no sale al elegir gente.
   */
  archivedAt?: number
}

/* --- Sushi ---------------------------------------------------------------- */

/** Un día de buffet. */
export interface SushiSession {
  id: string
  /** Cuándo fue (ms). Se puede poner en pasado para apuntar sesiones viejas. */
  date: number
  place?: string
  note?: string
  createdAt: number
}

/**
 * Lo que comió una persona en una sesión. Que exista la fila es lo que dice que
 * esa persona FUE: no todos van el mismo día, y un 0 de alguien que fue no es
 * lo mismo que alguien que no vino (lo segundo no le baja la media).
 */
export interface SushiEntry {
  id: string
  sessionId: string
  personId: string
  pieces: number
}

/* --- Bebida --------------------------------------------------------------- */

/** Tipo de bebida (chupito, cerveza…). La lista la edita el usuario. */
export interface DrinkType {
  id: string
  name: string
  sortOrder: number
  /** Igual que con la gente: se archiva para no romper sesiones viejas. */
  archivedAt?: number
}

/** Una noche, una ronda de chupitos, un «a ver quién bebe más». */
export interface DrinkSession {
  id: string
  date: number
  title?: string
  place?: string
  note?: string
  createdAt: number
}

/** Asistencia a una sesión de bebida (mismo criterio que `SushiEntry`). */
export interface DrinkEntry {
  id: string
  sessionId: string
  personId: string
}

/** Cuántas de un tipo lleva una persona en una sesión. */
export interface DrinkCount {
  id: string
  entryId: string
  typeId: string
  count: number
}

/* --- Gastos --------------------------------------------------------------- */

/** Un grupo de gastos con su propio balance (un viaje, una cena, el piso…). */
export interface ExpenseGroup {
  id: string
  name: string
  createdAt: number
  archivedAt?: number
}

/** Quién está en un grupo: es con quien se reparte por defecto. */
export interface GroupMember {
  id: string
  groupId: string
  personId: string
}

/**
 * `expense`: alguien paga algo por varios.
 * `transfer`: alguien le devuelve dinero a otro para saldar. Se guarda igual
 * que un gasto (paga uno, «consume» el otro), que es lo que hace que el balance
 * se cuadre sin ningún caso especial.
 */
export type ExpenseKind = 'expense' | 'transfer'

/**
 * `equal`: a partes iguales entre los marcados.
 * `shares`: por partes (uno pone 2, otro 1…).
 * `amounts`: cada uno su importe exacto, que tiene que sumar el total.
 */
export type SplitMode = 'equal' | 'shares' | 'amounts'

export interface Expense {
  id: string
  groupId: string
  kind: ExpenseKind
  title: string
  /** En CÉNTIMOS. Nunca decimales: 10 € entre 3 tiene que dar 3,34 + 3,33 + 3,33. */
  amount: number
  paidBy: string
  date: number
  splitMode: SplitMode
  createdAt: number
}

/** La parte de un gasto que le toca a una persona. */
export interface ExpenseShare {
  id: string
  expenseId: string
  personId: string
  /**
   * Lo que se eligió al repartir: 1 en `equal`, las partes en `shares`, los
   * céntimos en `amounts`. Se guarda para poder volver a editar el gasto tal
   * y como se metió.
   */
  weight: number
  /** Lo que le toca pagar, en céntimos, ya repartido y cuadrado al céntimo. */
  amount: number
}

/* --- Mus -------------------------------------------------------------------- */

/**
 * Una partida de mus, siempre por parejas fijas (2 contra 2). Los cuatro ids
 * se guardan en sus propias columnas y no como filas sueltas (al revés que
 * sushi o bebida): una partida SIEMPRE tiene exactamente cuatro jugadores, dos
 * por equipo, así que no hace falta una tabla de asistentes.
 */
export interface MusMatch {
  id: string
  date: number
  /** Piedras para ganar. 40 es lo más habitual, pero se puede cambiar. */
  target: number
  team1Player1: string
  team1Player2: string
  team2Player1: string
  team2Player2: string
  team1Score: number
  team2Score: number
  /** Ausente mientras se juega. 1 o 2 en cuanto un equipo llega a `target`. */
  winner?: 1 | 2
  note?: string
  createdAt: number
  finishedAt?: number
}

/* --- Ajustes y copia ------------------------------------------------------ */

export type ThemePref = 'dark' | 'light' | 'system'

export interface Settings {
  id: 'app'
  theme: ThemePref
  lastBackup: number
  onboardedAt?: number
  /** Quién eres tú en la cuadrilla, elegido en Cuadrilla. Para «mis gastos». */
  mePersonId?: string
  nextcloudUrl?: string
  nextcloudUser?: string
  /** No sale nunca en las copias: ver `backupCore.exportAll`. */
  nextcloudPassword?: string
  nextcloudFolder?: string
  autoBackup?: boolean
  lastAutoBackupAt?: number
  schemaVersion: number
}

export interface BackupFile {
  app: 'ludok-count'
  schemaVersion: number
  exportedAt: number
  people: Person[]
  sushiSessions: SushiSession[]
  sushiEntries: SushiEntry[]
  drinkTypes: DrinkType[]
  drinkSessions: DrinkSession[]
  drinkEntries: DrinkEntry[]
  drinkCounts: DrinkCount[]
  groups: ExpenseGroup[]
  groupMembers: GroupMember[]
  expenses: Expense[]
  expenseShares: ExpenseShare[]
  musMatches: MusMatch[]
  /** Sin la contraseña de Nextcloud, que no se exporta nunca. */
  settings?: Omit<Settings, 'nextcloudPassword'>
}
