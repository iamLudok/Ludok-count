import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { space } from '../../src/ui/theme'
import { useExpenses } from '../../src/hooks/useData'
import { useSettings } from '../../src/hooks/useSettings'
import { balances, settle, groupTotals } from '../../src/lib/expenses'
import { formatMoney } from '../../src/lib/money'
import { BackupBanner } from '../../src/components/BackupBanner'

export default function ExpensesScreen() {
  const { data, ready } = useExpenses()
  const { mePersonId } = useSettings()
  const [showArchived, setShowArchived] = useState(false)

  const cards = useMemo(
    () =>
      data.groups
        .map((g) => {
          const expenses = data.expenses.filter((e) => e.groupId === g.id)
          const ids = new Set(expenses.map((e) => e.id))
          const shares = data.shares.filter((s) => ids.has(s.expenseId))
          const bal = balances(expenses, shares)
          const last = expenses.reduce((m, e) => Math.max(m, e.date), g.createdAt)
          const isMine = mePersonId ? data.members.some((m) => m.groupId === g.id && m.personId === mePersonId) : false
          return {
            group: g,
            members: data.members.filter((m) => m.groupId === g.id).length,
            spent: groupTotals(expenses, shares).spent,
            pending: settle(bal).length,
            count: expenses.filter((e) => e.kind === 'expense').length,
            // undefined si no estás marcado o no estás en este grupo: así no se
            // muestra un «0 €» engañoso para quien nunca ha entrado a pagar nada.
            mine: isMine ? (bal.get(mePersonId!) ?? 0) : undefined,
            last,
          }
        })
        // El que se ha movido hace menos, arriba: es el que se está usando.
        .sort((a, b) => b.last - a.last),
    [data, mePersonId],
  )
  const active = cards.filter((c) => !c.group.archivedAt)
  const archived = cards.filter((c) => c.group.archivedAt)

  const renderCard = (c: (typeof cards)[number]) => (
    <Card key={c.group.id} onPress={() => router.push(`/group/${c.group.id}`)} style={styles.item}>
      <View style={styles.itemHead}>
        <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
          {c.group.name}
        </Txt>
        <Txt variant="amount">{formatMoney(c.spent)}</Txt>
      </View>
      {c.mine !== undefined ? (
        <View style={styles.itemHead}>
          <Txt variant="small" tone="muted" style={{ flex: 1 }}>
            Tu saldo
          </Txt>
          <Txt variant="data" tone={c.mine > 0 ? 'credit' : c.mine < 0 ? 'debt' : 'faint'}>
            {c.mine === 0 ? 'en paz' : formatMoney(c.mine, { sign: true })}
          </Txt>
        </View>
      ) : null}
      <Txt variant="small" tone="muted">
        {c.members} personas · {c.count} {c.count === 1 ? 'gasto' : 'gastos'} ·{' '}
        {c.pending ? `${c.pending} ${c.pending === 1 ? 'pago pendiente' : 'pagos pendientes'}` : 'todo saldado'}
      </Txt>
    </Card>
  )

  return (
    <Screen
      title="Gastos"
      padded={false}
      right={<Button title="Nuevo grupo" kind="primary" small onPress={() => router.push('/group/edit')} />}
    >
      {!ready ? null : data.groups.length === 0 ? (
        <Empty text="Crea un grupo (un viaje, una cena, el piso…) y apunta quién paga qué. La app calcula quién le debe a quién con los mínimos pagos posibles.">
          <Button title="Nuevo grupo" kind="primary" onPress={() => router.push('/group/edit')} />
        </Empty>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BackupBanner itemCount={data.expenses.length} />
          {active.map(renderCard)}
          {active.length === 0 ? (
            <Txt variant="body" tone="muted">
              Todos los grupos están archivados.
            </Txt>
          ) : null}
          {archived.length ? (
            <>
              <Label>Archivados</Label>
              {showArchived ? (
                archived.map(renderCard)
              ) : (
                <Button title={`Ver ${archived.length} archivados`} kind="ghost" onPress={() => setShowArchived(true)} />
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  item: { gap: space.xs, paddingVertical: space.md },
  itemHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
})
