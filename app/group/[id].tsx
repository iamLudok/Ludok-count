import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { Chips } from '../../src/ui/Chips'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useToast } from '../../src/ui/Toast'
import { radius, space } from '../../src/ui/theme'
import { useGroup, usePeopleById } from '../../src/hooks/useData'
import {
  balances,
  settle,
  groupTotals,
  addTransfer,
  deleteExpense,
  deleteGroup,
  setGroupArchived,
} from '../../src/lib/expenses'
import { formatMoney } from '../../src/lib/money'
import { relativeDay } from '../../src/lib/dates'
import { byName } from '../../src/lib/people'
import type { Expense } from '../../src/types'

type Tab = 'expenses' | 'balances'
const TABS = [
  { key: 'expenses' as const, label: 'Gastos' },
  { key: 'balances' as const, label: 'Saldos' },
]

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, ready } = useGroup(id)
  const people = usePeopleById()
  const palette = usePalette()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('expenses')

  const name = (pid: string) => people.get(pid)?.name ?? '¿?'
  const bal = useMemo(() => balances(data.expenses, data.shares), [data.expenses, data.shares])
  const payments = useMemo(() => settle(bal), [bal])
  const totals = useMemo(() => groupTotals(data.expenses, data.shares), [data.expenses, data.shares])
  const shareCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data.shares) m.set(s.expenseId, (m.get(s.expenseId) ?? 0) + 1)
    return m
  }, [data.shares])
  // Saldos de los miembros y de cualquiera que salga en un gasto aunque ya
  // no sea miembro: así ninguna deuda se queda sin dueño en la lista.
  const rows = useMemo(() => {
    const ids = new Set([...data.memberIds, ...bal.keys()])
    return [...ids]
      .map((pid) => ({ id: pid, name: people.get(pid)?.name ?? '¿?', balance: bal.get(pid) ?? 0 }))
      .sort((a, b) => b.balance - a.balance || byName(a, b))
  }, [data.memberIds, bal, people])
  const maxAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.balance)), 1)

  if (!ready) return <Screen back title="">{null}</Screen>
  const group = data.group
  if (!group) {
    return (
      <Screen back title="Grupo">
        <Empty text="Este grupo ya no existe." />
      </Screen>
    )
  }

  const markPaid = (from: string, to: string, amount: number) =>
    Alert.alert(
      'Apuntar pago',
      `¿${name(from)} le ha pagado ${formatMoney(amount)} a ${name(to)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, pagado',
          onPress: async () => {
            await addTransfer(group.id, from, to, amount)
            toast('Pago apuntado')
          },
        },
      ],
    )

  const openExpense = (e: Expense) => {
    if (e.kind === 'expense') {
      router.push(`/expense/edit?groupId=${group.id}&id=${e.id}`)
      return
    }
    const to = data.shares.find((s) => s.expenseId === e.id)?.personId
    Alert.alert(
      'Reembolso',
      `${name(e.paidBy)} → ${to ? name(to) : '¿?'}: ${formatMoney(e.amount)}`,
      [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Deshacer pago', style: 'destructive', onPress: () => deleteExpense(e.id) },
      ],
    )
  }

  const archive = () => setGroupArchived(group.id, !group.archivedAt)
  const destroy = () =>
    Alert.alert('¿Borrar el grupo?', 'Se borran todos sus gastos y pagos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteGroup(group.id)
          router.back()
        },
      },
    ])

  return (
    <Screen
      back
      title={group.name}
      subtitle={`${data.memberIds.length} personas · ${formatMoney(totals.spent)} gastados${group.archivedAt ? ' · archivado' : ''}`}
      padded={false}
      right={<Button title="Editar" kind="ghost" small onPress={() => router.push(`/group/edit?id=${group.id}`)} />}
    >
      <View style={styles.tabs}>
        <Chips options={TABS} value={tab} onChange={setTab} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'expenses' ? (
          <>
            <Button
              title="Añadir gasto"
              kind="primary"
              onPress={() => router.push(`/expense/edit?groupId=${group.id}`)}
            />
            {data.expenses.length === 0 ? (
              <Txt variant="body" tone="muted" style={styles.hint}>
                Sin gastos todavía.
              </Txt>
            ) : null}
            {data.expenses.map((e) => {
              const transfer = e.kind === 'transfer'
              const to = transfer ? data.shares.find((s) => s.expenseId === e.id)?.personId : undefined
              return (
                <Card key={e.id} onPress={() => openExpense(e)} style={styles.item}>
                  <View style={styles.itemHead}>
                    <Txt variant="section" tone={transfer ? 'muted' : 'fg'} numberOfLines={1} style={{ flex: 1 }}>
                      {transfer ? `${name(e.paidBy)} → ${to ? name(to) : '¿?'}` : e.title}
                    </Txt>
                    <Txt variant="amount" tone={transfer ? 'muted' : 'fg'}>
                      {formatMoney(e.amount)}
                    </Txt>
                  </View>
                  <Txt variant="small" tone="muted">
                    {transfer
                      ? `Reembolso · ${relativeDay(e.date)}`
                      : `Pagó ${name(e.paidBy)} · entre ${shareCount.get(e.id) ?? 0} · ${relativeDay(e.date)}`}
                  </Txt>
                </Card>
              )
            })}
          </>
        ) : (
          <>
            <Card>
              {rows.map((r) => (
                <View key={r.id} style={styles.balRow}>
                  <View style={styles.balHead}>
                    <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {r.name}
                    </Txt>
                    <Txt variant="amount" tone={r.balance > 0 ? 'credit' : r.balance < 0 ? 'debt' : 'faint'}>
                      {formatMoney(r.balance, { sign: true })}
                    </Txt>
                  </View>
                  {/* Barra centrada: a la derecha lo que le deben, a la izquierda lo que debe. */}
                  <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
                    <View style={styles.half}>
                      {r.balance < 0 ? (
                        <View
                          style={[
                            styles.fill,
                            { backgroundColor: palette.debt, width: `${(Math.abs(r.balance) / maxAbs) * 100}%` },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={[styles.axis, { backgroundColor: palette.line }]} />
                    <View style={[styles.half, { alignItems: 'flex-start' }]}>
                      {r.balance > 0 ? (
                        <View
                          style={[
                            styles.fill,
                            { backgroundColor: palette.credit, width: `${(r.balance / maxAbs) * 100}%` },
                          ]}
                        />
                      ) : null}
                    </View>
                  </View>
                  <Txt variant="data" tone="faint">
                    pagó {formatMoney(totals.paidBy.get(r.id) ?? 0)} · le tocó{' '}
                    {formatMoney(totals.consumed.get(r.id) ?? 0)}
                  </Txt>
                </View>
              ))}
            </Card>

            <Label>Cómo quedar en paz</Label>
            {payments.length === 0 ? (
              <Txt variant="body" tone="muted" style={styles.hint}>
                Todo saldado. Nadie le debe nada a nadie.
              </Txt>
            ) : (
              <>
                {payments.map((p) => (
                  <Card key={`${p.from}-${p.to}`} style={styles.payment}>
                    <View style={{ flex: 1, gap: space.xs }}>
                      <Txt variant="body" numberOfLines={1}>
                        {name(p.from)} → {name(p.to)}
                      </Txt>
                      <Txt variant="amount">{formatMoney(p.amount)}</Txt>
                    </View>
                    <Button title="Pagado" small onPress={() => markPaid(p.from, p.to, p.amount)} />
                  </Card>
                ))}
                <Txt variant="small" tone="faint">
                  Son los mínimos pagos para que todos queden a cero: si A le debe a B y B a C, A le paga
                  directamente a C. Cuando un reparto a partes iguales no da un número exacto de
                  céntimos (110 € entre 6, por ejemplo), el céntimo de más se lo queda quien pagó: el
                  resto nunca paga de menos, pero tampoco de más que los demás.
                </Txt>
              </>
            )}
          </>
        )}

        <View style={[styles.footer, { borderTopColor: palette.line }]}>
          <Button title={group.archivedAt ? 'Sacar del archivo' : 'Archivar grupo'} onPress={archive} />
          <Button title="Borrar grupo" kind="danger" onPress={destroy} />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.md },
  hint: { paddingVertical: space.md },
  item: { gap: space.xs, paddingVertical: space.md },
  itemHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  balRow: { gap: space.xs },
  balHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  track: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  half: { flex: 1, alignItems: 'flex-end' },
  axis: { width: 2 },
  fill: { height: 6 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  footer: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
})
