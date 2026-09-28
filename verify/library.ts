/**
 * Verificación de las reglas del dominio: gente, sushi, bebida y gastos.
 *
 * Ejecuta los `lib/*.ts` reales (los mismos que corren en el móvil) contra un
 * SQLite de escritorio, gracias a que la base de datos se pide por `dbRef`.
 * Lo más delicado está en los gastos: que ningún reparto pierda o invente un
 * céntimo y que los pagos sugeridos dejen de verdad a todos a cero.
 */
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import * as schema from '../src/lib/schema'
import { CREATE_SQL } from '../src/lib/schemaSql'
import { setDb, getDb } from '../src/lib/dbRef'
import { exportAll, type AppDb } from '../src/lib/backupCore'
import { ensureSettings, getSettings, updateSettings } from '../src/lib/settings'
import { addPerson, addPeople, renamePerson, removePerson, listPeople, nameKey } from '../src/lib/people'
import {
  createSushiSession,
  addPieces,
  setPieces,
  addSushiAttendee,
  removeSushiAttendee,
  deleteSushiSession,
  sushiStatsByPerson,
  summarizeSushiSessions,
  sushiRecord,
} from '../src/lib/sushi'
import {
  listDrinkTypes,
  addDrinkType,
  setDrinkTypeArchived,
  moveDrinkType,
  createDrinkSession,
  addDrink,
  removeDrinkAttendee,
  deleteDrinkSession,
  drinkStatsByPerson,
  DEFAULT_DRINK_TYPES,
} from '../src/lib/drinks'
import { parseMoney, formatMoney, splitByWeights, moneyToInput } from '../src/lib/money'
import {
  buildShares,
  createGroup,
  addExpense,
  updateExpense,
  deleteExpense,
  addTransfer,
  setGroupMembers,
  deleteGroup,
  loadGroup,
  balances,
  settle,
  groupTotals,
} from '../src/lib/expenses'
import { rank } from '../src/lib/ranking'
import {
  createMusMatch,
  updateMusMatch,
  deleteMusMatch,
  addMusPoint,
  setMusScore,
  reopenMusMatch,
  musStatsByPerson,
  ongoingMusMatches,
  finishedMusMatches,
} from '../src/lib/mus'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}
async function rejects(label: string, fn: () => Promise<unknown> | unknown) {
  try {
    await fn()
    check(`rechaza ${label}`, false, 'no lanzó error')
  } catch (e) {
    check(`rechaza ${label}`, true, e instanceof Error ? `«${e.message}»` : '')
  }
}

const tempFiles: string[] = []
let seq = 0
async function useFreshDb(): Promise<AppDb> {
  const path = join(tmpdir(), `ludok-count-lib-${process.pid}-${seq++}.db`)
  rmSync(path, { force: true })
  tempFiles.push(path)
  const client = createClient({ url: `file:${path}` })
  await client.executeMultiple(CREATE_SQL)
  const database = drizzle(client, { schema }) as unknown as AppDb
  setDb(database)
  return database
}
function cleanup() {
  for (const f of tempFiles) for (const s of ['', '-wal', '-shm']) rmSync(f + s, { force: true })
}

async function main() {
  console.log('\n=== 1. Dinero: leer y escribir ===')
  eq('«12» son 1200 céntimos', parseMoney('12'), 1200)
  eq('«12,5»', parseMoney('12,5'), 1250)
  eq('«12.50»', parseMoney('12.50'), 1250)
  eq('«1.234,56»', parseMoney('1.234,56'), 123456)
  eq('«1,234.56» (formato inglés)', parseMoney('1,234.56'), 123456)
  eq('«1.500» son mil quinientos, no 1,5', parseMoney('1.500'), 150000)
  eq('«8 €»', parseMoney('8 €'), 800)
  eq('«0,1»', parseMoney('0,1'), 10)
  eq('vacío es null', parseMoney(''), null)
  eq('negativo es null', parseMoney('-5'), null)
  eq('tres decimales es null', parseMoney('1,234'), null)
  eq('letras es null', parseMoney('doce'), null)
  eq('formato 123456', formatMoney(123456), '1.234,56 €')
  eq('formato 5', formatMoney(5), '0,05 €')
  eq('formato negativo', formatMoney(-1050), '−10,50 €')
  eq('formato con signo', formatMoney(300, { sign: true }), '+3,00 €')
  eq('para editar', moneyToInput(1250), '12,50')
  // Ida y vuelta de cualquier importe razonable: lo que se pinta se vuelve a leer igual.
  let roundTrip = true
  for (let c = 0; c < 200000; c += 37) if (parseMoney(formatMoney(c)) !== c) roundTrip = false
  check('formatMoney → parseMoney devuelve lo mismo', roundTrip)

  console.log('\n=== 2. Repartos al céntimo ===')
  const tres = splitByWeights(1000, [1, 1, 1])
  eq('sin pagador de favor: 10 € entre 3 = 3,34 + 3,33 + 3,33', tres.join(','), '334,333,333')
  eq('por partes 2:1 de 10 €', splitByWeights(1000, [2, 1]).join(','), '667,333')
  eq('peso 0 no paga nada', splitByWeights(1000, [1, 0, 1]).join(','), '500,0,500')

  // Con `favor` (quien pagó), el sobrante nunca es para él: aquí el índice 0
  // se queda con los 3,33 € redondeados hacia abajo, y el céntimo de más cae
  // en el índice 1 (el siguiente por decimales), nunca en el 0.
  eq('con pagador de favor: el 0 nunca sube', splitByWeights(1000, [1, 1, 1], 0).join(','), '333,334,333')
  // 110 € entre 6: solo sobran 2 céntimos, así que solo dos personas los
  // llevan — nunca quien pagó, esté donde esté en la lista.
  const seis = splitByWeights(11000, [1, 1, 1, 1, 1, 1], 2)
  eq('110 € entre 6, pagó el tercero: él nunca sube', seis[2], 1833)
  eq('solo suben dos, los primeros por orden', seis.join(','), '1834,1834,1833,1833,1833,1833')
  eq('la suma sigue siendo el total', seis.reduce((a, b) => a + b, 0), 11000)

  let exact = true
  let payerNeverGainsExtra = true
  for (let total = 1; total < 3000; total += 7) {
    for (const w of [[1, 1, 1], [3, 1, 2], [1, 1, 1, 1, 1, 1, 1], [5, 7], [1]]) {
      const sum = w.reduce((a, b) => a + b, 0)
      for (const favor of [undefined, ...w.map((_, i) => i)]) {
        const parts = splitByWeights(total, w, favor)
        if (parts.reduce((a, b) => a + b, 0) !== total) exact = false
        // Nadie se aleja más de un céntimo de su parte exacta.
        if (parts.some((p, i) => Math.abs(p - (total * w[i]) / sum) >= 1)) exact = false
        // Con favor, esa persona nunca paga más que su parte exacta redondeada
        // hacia abajo: el redondeo nunca la perjudica.
        if (favor !== undefined && w[favor] > 0) {
          if (parts[favor] > Math.floor((total * w[favor]) / sum)) payerNeverGainsExtra = false
        }
      }
    }
  }
  check('miles de repartos: la suma es siempre el total y nadie pierde más de 1 céntimo', exact)
  check('y quien pagó nunca sube por el redondeo', payerNeverGainsExtra)

  const eqShares = buildShares(
    1000,
    'equal',
    [
      { personId: 'a', value: 1 },
      { personId: 'b', value: 1 },
      { personId: 'c', value: 0 },
    ],
    'a',
  )
  eq('a partes iguales solo entre los marcados', eqShares.length, 2)
  eq('y cada uno 5 €', eqShares.map((s) => s.amount).join(','), '500,500')
  await rejects('importes que no suman el total', () =>
    buildShares(
      1000,
      'amounts',
      [
        { personId: 'a', value: 400 },
        { personId: 'b', value: 500 },
      ],
      'a',
    ),
  )
  await rejects('un gasto de 0 €', () => buildShares(0, 'equal', [{ personId: 'a', value: 1 }], 'a'))
  await rejects('un reparto sin nadie', () => buildShares(1000, 'equal', [{ personId: 'a', value: 0 }], 'a'))
  const dup = buildShares(
    900,
    'equal',
    [
      { personId: 'a', value: 1 },
      { personId: 'a', value: 1 },
      { personId: 'b', value: 1 },
    ],
    'a',
  )
  eq('alguien repetido en el formulario cuenta una vez', dup.length, 2)

  // El caso que motivó todo esto: 110 € entre 6, pagados por Ane. Que quede
  // claro que a ella nunca le toca pagar más que a los demás.
  const win = buildShares(
    11000,
    'equal',
    ['ane', 'iker', 'mikel', 'nerea', 'jon', 'ane2'].map((personId) => ({ personId, value: 1 })),
    'ane',
  )
  const anePart = win.find((s) => s.personId === 'ane')!.amount
  check('quien paga nunca debe más que el resto', win.every((s) => s.amount >= anePart))
  eq('la suma sigue siendo 110 €', win.reduce((s, x) => s + x.amount, 0), 11000)

  console.log('\n=== 3. Saldar deudas: lo de «A le paga directamente a C» ===')
  // A le debe 10 a B, y B le debe 10 a C: B queda a cero y A le paga a C.
  const chain = settle(new Map([['A', -1000], ['B', 0], ['C', 1000]]))
  eq('la cadena A→B→C es un solo pago', chain.length, 1)
  eq('de A', chain[0]?.from, 'A')
  eq('a C', chain[0]?.to, 'C')
  eq('de 10 €', chain[0]?.amount, 1000)
  // Pares exactos primero: sin eso, el voraz haría 3 pagos donde bastan 2.
  const pairs = settle(new Map([['A', -700], ['B', -500], ['C', 500], ['D', 700]]))
  eq('dos parejas exactas = dos pagos', pairs.length, 2)
  // Con saldos al azar: todo el mundo acaba a cero y nunca más de n−1 pagos.
  let allZero = true
  let bounded = true
  let rnd = 42
  const next = () => (rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  for (let round = 0; round < 500; round++) {
    const n = 2 + Math.floor(next() * 9)
    const vals = Array.from({ length: n - 1 }, () => Math.round((next() - 0.5) * 20000))
    vals.push(-vals.reduce((a, b) => a + b, 0))
    const bal = new Map(vals.map((v, i) => [`p${i}`, v]))
    const pays = settle(bal)
    const after = new Map(bal)
    for (const p of pays) {
      after.set(p.from, after.get(p.from)! + p.amount)
      after.set(p.to, after.get(p.to)! - p.amount)
      if (p.amount <= 0) allZero = false
    }
    if ([...after.values()].some((v) => v !== 0)) allZero = false
    if (pays.length > n - 1) bounded = false
  }
  check('500 grupos al azar: todos quedan a cero, sin pagos de 0 €', allZero)
  check('y nunca hacen falta más de n−1 pagos', bounded)
  eq('sin deudas, sin pagos', settle(new Map([['A', 0], ['B', 0]])).length, 0)

  console.log('\n=== 4. Clasificaciones con empate ===')
  const podium = rank(
    [
      { id: 'a', n: 30 },
      { id: 'b', n: 50 },
      { id: 'c', n: 30 },
      { id: 'd', n: 10 },
      { id: 'e', n: 0 },
    ],
    (x) => x.n,
  )
  eq('primero el de 50', podium[0].item.id, 'b')
  eq('los de 30 empatan en el 2º', podium.map((p) => p.position).join(','), '1,2,2,4,')

  console.log('\n=== 5. La cuadrilla ===')
  await useFreshDb()
  await ensureSettings()
  const ane = await addPerson('  Ane  ')
  eq('el nombre se limpia', ane.name, 'Ane')
  await rejects('un nombre repetido (sin tildes ni mayúsculas)', () => addPerson('ANE'))
  await rejects('un nombre vacío', () => addPerson('   '))
  eq('Iñaki e inaki son la misma clave', nameKey('Iñaki '), nameKey('inaki'))
  const bulk = await addPeople('Iker, Mikel\nNerea\n\nane')
  eq('alta de varios de golpe', bulk.added.length, 3)
  eq('el repetido se salta sin cortar el resto', bulk.skipped.join(), 'ane')
  const people = await listPeople()
  const id = (name: string) => people.find((p) => p.name === name)!.id
  await rejects('renombrar a un nombre que ya existe', () => renamePerson(id('Iker'), 'nerea'))
  await renamePerson(id('Iker'), 'Iker G.')
  eq('renombrar funciona', (await listPeople()).find((p) => p.id === id('Iker'))?.name, 'Iker G.')
  const typo = await addPerson('Mikle')
  await updateSettings({ mePersonId: typo.id })
  eq('alguien sin historial se borra de verdad', await removePerson(typo.id), 'deleted')
  eq('y si era «tú», deja de serlo', (await getSettings()).mePersonId, undefined)

  console.log('\n=== 6. Sushi ===')
  const s1 = await createSushiSession({ place: '  Sushi Bar ' }, [id('Ane'), id('Iker'), id('Iker')])
  const entries = async () => (await exportAll(getDb())).sushiEntries.filter((e) => e.sessionId === s1)
  eq('la misma persona dos veces entra una', (await entries()).length, 2)
  const eAne = (await entries()).find((e) => e.personId === id('Ane'))!
  // Veinte toques «a la vez»: con leer-sumar-escribir se perdían.
  await Promise.all(Array.from({ length: 20 }, () => addPieces(eAne.id, 1)))
  eq('20 toques seguidos = 20 trozos', (await entries()).find((e) => e.id === eAne.id)?.pieces, 20)
  await addPieces(eAne.id, -50)
  eq('nunca baja de 0', (await entries()).find((e) => e.id === eAne.id)?.pieces, 0)
  await setPieces(eAne.id, 42)
  eq('corregir a mano', (await entries()).find((e) => e.id === eAne.id)?.pieces, 42)
  await addSushiAttendee(s1, id('Nerea'))
  await addSushiAttendee(s1, id('Nerea'))
  eq('llega tarde, y un doble toque no la duplica', (await entries()).length, 3)
  await removeSushiAttendee(s1, id('Nerea'))
  eq('y se puede quitar', (await entries()).length, 2)
  eq('alguien con historial se archiva, no se borra', await removePerson(id('Ane')), 'archived')
  eq('y sigue en la lista', (await listPeople()).some((p) => p.id === id('Ane') && p.archivedAt), true)

  // Estadísticas: Mikel va a una sola sesión; no ir no le baja la media.
  const s2 = await createSushiSession({}, [id('Ane'), id('Mikel')])
  const all = (await exportAll(getDb())).sushiEntries
  const eMikel = all.find((e) => e.sessionId === s2 && e.personId === id('Mikel'))!
  const eAne2 = all.find((e) => e.sessionId === s2 && e.personId === id('Ane'))!
  await setPieces(eMikel.id, 30)
  await setPieces(eAne2.id, 20)
  const data = await exportAll(getDb())
  const stats = sushiStatsByPerson(data.sushiEntries)
  eq('Ane fue a 2', stats.get(id('Ane'))?.sessions, 2)
  eq('media de Ane (42+20)/2', stats.get(id('Ane'))?.average, 31)
  eq('mejor marca de Ane', stats.get(id('Ane'))?.best, 42)
  eq('Mikel fue a 1 y su media es 30', stats.get(id('Mikel'))?.average, 30)
  eq('Iker fue y comió 0: media 0, no «sin datos»', stats.get(id('Iker'))?.average, 0)
  eq('récord absoluto', sushiRecord(data.sushiEntries)?.pieces, 42)
  const summary = summarizeSushiSessions(data.sushiSessions, data.sushiEntries)
  eq('historial con la más reciente primero', summary[0].session.id, s2)
  eq('ganador de la primera sesión', summary[1].winners.join(), id('Ane'))
  eq('el sitio se guarda limpio', data.sushiSessions.find((s) => s.id === s1)?.place, 'Sushi Bar')
  await deleteSushiSession(s1)
  const afterDel = await exportAll(getDb())
  eq('borrar la sesión se lleva sus entradas', afterDel.sushiEntries.filter((e) => e.sessionId === s1).length, 0)
  eq('y no toca las de otras', afterDel.sushiEntries.length, 2)

  console.log('\n=== 7. Bebida ===')
  const types = await listDrinkTypes()
  eq('instalación nueva: tipos de serie', types.map((t) => t.name).join(), DEFAULT_DRINK_TYPES.join())
  await ensureSettings()
  eq('arrancar otra vez no los duplica', (await listDrinkTypes()).length, DEFAULT_DRINK_TYPES.length)
  const chupito = types[0]
  const cerveza = types[1]
  const d1 = await createDrinkSession({ title: 'Ronda de chupitos' }, [id('Ane'), id('Nerea')])
  const dEntries = async () => (await exportAll(getDb())).drinkEntries.filter((e) => e.sessionId === d1)
  const deAne = (await dEntries()).find((e) => e.personId === id('Ane'))!
  const deNerea = (await dEntries()).find((e) => e.personId === id('Nerea'))!
  await Promise.all(Array.from({ length: 7 }, () => addDrink(deAne.id, chupito.id, 1)))
  await addDrink(deAne.id, cerveza.id, 2)
  await addDrink(deNerea.id, chupito.id, 3)
  await addDrink(deNerea.id, chupito.id, -5)
  const counts = (await exportAll(getDb())).drinkCounts
  eq('7 chupitos seguidos = 7', counts.find((c) => c.entryId === deAne.id && c.typeId === chupito.id)?.count, 7)
  eq('una fila por persona y tipo', counts.filter((c) => c.entryId === deAne.id).length, 2)
  eq('restar de más se queda en 0', counts.find((c) => c.entryId === deNerea.id)?.count, 0)
  const dstats = drinkStatsByPerson((await exportAll(getDb())).drinkEntries, counts)
  eq('Ane lleva 9 en total', dstats.get(id('Ane'))?.total, 9)
  eq('de ellos 7 chupitos', dstats.get(id('Ane'))?.byType.get(chupito.id), 7)
  await removeDrinkAttendee(d1, id('Nerea'))
  const afterRemove = await exportAll(getDb())
  eq('quitar a alguien se lleva lo suyo', afterRemove.drinkCounts.filter((c) => c.entryId === deNerea.id).length, 0)
  await setDrinkTypeArchived(cerveza.id, true)
  const again = await addDrinkType('cerveza')
  eq('volver a crear uno quitado lo recupera (mismo id)', again.id, cerveza.id)
  await rejects('un tipo repetido', () => addDrinkType('Chupito'))
  await moveDrinkType(chupito.id, 1)
  eq('mover un tipo abajo', (await listDrinkTypes())[1].id, chupito.id)
  await moveDrinkType(chupito.id, -1)
  await moveDrinkType(chupito.id, -1)
  eq('y arriba del todo no se sale de la lista', (await listDrinkTypes())[0].id, chupito.id)
  await deleteDrinkSession(d1)
  const afterDrinkDel = await exportAll(getDb())
  eq('borrar la sesión no deja asistentes', afterDrinkDel.drinkEntries.length, 0)
  eq('ni bebidas huérfanas', afterDrinkDel.drinkCounts.length, 0)

  console.log('\n=== 8. Gastos ===')
  await rejects('un grupo de una sola persona', () => createGroup('Solo', [id('Ane')]))
  const A = id('Ane')
  const B = id('Iker')
  const C = id('Nerea')
  const g = await createGroup('Viaje', [A, B, C])
  // Ane paga la gasolina (60 €) entre los tres.
  await addExpense({ groupId: g, title: 'Gasolina', amount: 6000, paidBy: A, splitMode: 'equal',
    parts: [A, B, C].map((personId) => ({ personId, value: 1 })) })
  // Iker paga la cena (100 €): Nerea come por dos.
  const cena = await addExpense({ groupId: g, title: 'Cena', amount: 10000, paidBy: B, splitMode: 'shares',
    parts: [{ personId: A, value: 1 }, { personId: B, value: 1 }, { personId: C, value: 2 }] })
  let grp = await loadGroup(g)
  let bal = balances(grp.expenses, grp.shares)
  eq('Ane: pagó 60, le tocan 20+25 → +15', bal.get(A), 1500)
  eq('Iker: pagó 100, le tocan 20+25 → +55', bal.get(B), 5500)
  eq('Nerea: le tocan 20+50 → −70', bal.get(C), -7000)
  eq('la suma de saldos es 0', [...bal.values()].reduce((a, b) => a + b, 0), 0)
  const pays = settle(bal)
  eq('Nerea paga dos veces', pays.length, 2)
  eq('y todo lo que debe', pays.reduce((s, p) => s + p.amount, 0), 7000)
  // Se marcan como pagados: todo el mundo a cero.
  for (const p of pays) await addTransfer(g, p.from, p.to, p.amount)
  grp = await loadGroup(g)
  bal = balances(grp.expenses, grp.shares)
  check('tras los reembolsos, todos a cero', [...bal.values()].every((v) => v === 0))
  eq('y ya no hace falta ningún pago', settle(bal).length, 0)
  const totals = groupTotals(grp.expenses, grp.shares)
  eq('lo gastado no cuenta los reembolsos', totals.spent, 16000)
  eq('lo que consumió Nerea', totals.consumed.get(C), 7000)
  await rejects('pagarse a uno mismo', () => addTransfer(g, A, A, 100))

  // Editar: la cena pasa a ser a partes exactas.
  await updateExpense(cena, { title: 'Cena', amount: 9000, paidBy: B, splitMode: 'amounts',
    parts: [{ personId: A, value: 2000 }, { personId: B, value: 3000 }, { personId: C, value: 4000 }] })
  grp = await loadGroup(g)
  eq('editar reescribe los repartos, sin dejar viejos', grp.shares.filter((s) => s.expenseId === cena).length, 3)
  eq('la suma sigue siendo 0 tras editar', [...balances(grp.expenses, grp.shares).values()].reduce((a, b) => a + b, 0), 0)
  await rejects('editar con importes que no cuadran', () =>
    updateExpense(cena, { title: 'Cena', amount: 9000, paidBy: B, splitMode: 'amounts',
      parts: [{ personId: A, value: 1 }] }))
  eq('y un error al editar no rompe lo que había', (await loadGroup(g)).shares.filter((s) => s.expenseId === cena).length, 3)

  // Quitar miembros: a quien sale en gastos no se le quita.
  const M = id('Mikel')
  await setGroupMembers(g, [A, B, C, M])
  const { kept } = await setGroupMembers(g, [A, B])
  eq('Nerea tiene gastos: se queda', kept.join(), C)
  const members = (await exportAll(getDb())).groupMembers.filter((m) => m.groupId === g).map((m) => m.personId)
  check('Mikel no tenía nada: se va', !members.includes(M))
  eq('quedan tres', members.length, 3)

  await deleteExpense(cena)
  eq('borrar un gasto se lleva sus repartos', (await loadGroup(g)).shares.some((s) => s.expenseId === cena), false)
  await deleteGroup(g)
  const empty = await exportAll(getDb())
  eq('borrar el grupo no deja gastos', empty.expenses.length, 0)
  eq('ni repartos', empty.expenseShares.length, 0)
  eq('ni miembros', empty.groupMembers.length, 0)

  console.log('\n=== 9. Mus ===')
  const musOf = async (id: string) => (await exportAll(getDb())).musMatches.find((m) => m.id === id)!
  await rejects('parejas con alguien repetido entre equipos', () =>
    createMusMatch({ target: 40, team1: [A, B], team2: [B, C] }),
  )
  await rejects('menos de cuatro personas distintas', () =>
    createMusMatch({ target: 40, team1: [A, A], team2: [B, C] }),
  )
  await rejects('una meta de piedras inválida', () => createMusMatch({ target: 0, team1: [A, B], team2: [C, M] }))

  // Partida corta (a 5) para no tener que darle al «+1» cuarenta veces.
  const matchId = await createMusMatch({ target: 5, team1: [A, B], team2: [C, M] })
  const fresh = await musOf(matchId)
  eq('arranca 0 a 0', `${fresh.team1Score}-${fresh.team2Score}`, '0-0')
  check('sin ganador todavía', fresh.winner === undefined)

  // Veinte toques «a la vez», por lo mismo que los trozos de sushi: no pueden pisarse.
  const other = await createMusMatch({ target: 999, team1: [A, B], team2: [C, M] })
  await Promise.all(Array.from({ length: 20 }, () => addMusPoint(other, 1, 1)))
  eq('20 toques seguidos = 20 piedras', (await musOf(other)).team1Score, 20)
  await addMusPoint(other, 1, -100)
  eq('nunca baja de 0', (await musOf(other)).team1Score, 0)

  // Sumar hasta la meta cierra la partida sola.
  await addMusPoint(matchId, 1, 3)
  check('con 3 de 5 sigue en juego', (await musOf(matchId)).winner === undefined)
  await addMusPoint(matchId, 1, 2)
  const closed = await musOf(matchId)
  eq('al llegar a la meta, gana el equipo 1', closed.winner, 1)
  check('y queda fecha de cierre', closed.finishedAt !== undefined)

  // Cerrada, no se puede seguir sumando: hay que reabrirla primero.
  await addMusPoint(matchId, 2, 1)
  eq('una partida cerrada no admite más puntos', (await musOf(matchId)).team2Score, 0)
  await reopenMusMatch(matchId)
  const reopened = await musOf(matchId)
  check('reabrir quita el ganador', reopened.winner === undefined)
  eq('pero no toca el marcador', reopened.team1Score, 5)

  // El equipo 1 se quedó a la vista de la meta al reabrir: hay que corregirlo
  // hacia abajo con `setMusScore` ANTES de seguir sumando, o el primer punto
  // que caiga (al que sea) volvería a cerrarla en el acto.
  await setMusScore(matchId, 1, 4)
  check('corregir hacia abajo no cierra la partida', (await musOf(matchId)).winner === undefined)
  await addMusPoint(matchId, 2, 1)
  eq('ahora sí suma', (await musOf(matchId)).team2Score, 1)

  // Corregir a mano también puede cerrar la partida, y a igualdad de piedras
  // decide el equipo con más: aquí el equipo 2.
  await setMusScore(matchId, 2, 5)
  eq('corregir a mano hasta la meta cierra la partida', (await musOf(matchId)).winner, 2)

  await updateMusMatch(matchId, { note: 'Con remontada' })
  eq('se puede anotar cómo fue', (await musOf(matchId)).note, 'Con remontada')
  await rejects('cambiar a una meta inválida', () => updateMusMatch(matchId, { target: -1 }))

  const third = await createMusMatch({ target: 40, team1: [A, M], team2: [B, C] })
  const ongoing = ongoingMusMatches((await exportAll(getDb())).musMatches)
  check('las que siguen en juego no tienen ganador', ongoing.every((m) => !m.winner))
  eq('están la nueva y la de prueba de toques, nada más', ongoing.length, 2)
  eq('la última creada sale primero', ongoing[0]?.id, third)
  const finished = finishedMusMatches((await exportAll(getDb())).musMatches)
  eq('solo la de las parejas está cerrada', finished.map((m) => m.id).join(), matchId)

  // team1=[A,M] gana esta: A y M suman una victoria más cada uno.
  await addMusPoint(third, 1, 40)
  const musStats = musStatsByPerson((await exportAll(getDb())).musMatches)
  // matchId (C,M vs A,B) la ganó el equipo 2 → C y M ganan, A y B pierden.
  // third (A,M vs B,C) la gana el equipo 1 → A y M ganan, B y C pierden.
  eq('A: perdió una y ganó otra', `${musStats.get(A)?.wins}-${musStats.get(A)?.losses}`, '1-1')
  eq('B: perdió las dos', `${musStats.get(B)?.wins}-${musStats.get(B)?.losses}`, '0-2')
  eq('C: ganó una y perdió otra', `${musStats.get(C)?.wins}-${musStats.get(C)?.losses}`, '1-1')
  eq('M: ganó las dos', `${musStats.get(M)?.wins}-${musStats.get(M)?.losses}`, '2-0')
  eq('la media de M es del 100 %', musStats.get(M)?.winRate, 1)
  check('la partida sin cerrar (other) no cuenta para nadie', musStats.get(A)?.matches === 2)

  await deleteMusMatch(other)
  check('borrar una partida la quita de verdad', !(await exportAll(getDb())).musMatches.some((m) => m.id === other))

  console.log('\n=== 10. Ajustes ===')
  await updateSettings({ theme: 'light' })
  eq('se guarda el tema', (await getSettings()).theme, 'light')
  eq('y lo demás queda como estaba', (await getSettings()).lastBackup, 0)

  console.log(
    failures === 0
      ? '\n✅ LAS REGLAS SE CUMPLEN — ni un céntimo ni un trozo perdido\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanup()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  cleanup()
  process.exit(1)
})
