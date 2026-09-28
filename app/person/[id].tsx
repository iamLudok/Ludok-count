import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Row } from '../../src/ui/Card'
import { Prompt } from '../../src/ui/Prompt'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useToast } from '../../src/ui/Toast'
import { space } from '../../src/ui/theme'
import { usePeople, useSushi, useDrinks, useDrinkTypes, useExpenses } from '../../src/hooks/useData'
import { renamePerson, removePerson, setPersonArchived } from '../../src/lib/people'
import { sushiStatsByPerson } from '../../src/lib/sushi'
import { drinkStatsByPerson } from '../../src/lib/drinks'
import { balances, groupTotals } from '../../src/lib/expenses'
import { formatMoney } from '../../src/lib/money'
import { relativeDay } from '../../src/lib/dates'

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: people, ready } = usePeople()
  const { data: sushi } = useSushi()
  const { data: drinks } = useDrinks()
  const { data: types } = useDrinkTypes()
  const { data: money } = useExpenses()
  const palette = usePalette()
  const toast = useToast()
  const [renaming, setRenaming] = useState(false)

  const person = people.find((p) => p.id === id)
  const s = useMemo(() => sushiStatsByPerson(sushi.entries).get(id), [sushi.entries, id])
  const d = useMemo(() => drinkStatsByPerson(drinks.entries, drinks.counts).get(id), [drinks, id])
  const lastSushi = useMemo(() => {
    const sessions = new Map(sushi.sessions.map((x) => [x.id, x]))
    return sushi.entries
      .filter((e) => e.personId === id)
      .map((e) => ({ e, session: sessions.get(e.sessionId) }))
      .filter((x) => x.session)
      .sort((a, b) => b.session!.date - a.session!.date)
      .slice(0, 5)
  }, [sushi, id])
  const groups = useMemo(
    () =>
      money.groups
        .map((g) => {
          const exp = money.expenses.filter((e) => e.groupId === g.id)
          const ids = new Set(exp.map((e) => e.id))
          const shares = money.shares.filter((x) => ids.has(x.expenseId))
          return {
            group: g,
            balance: balances(exp, shares).get(id) ?? 0,
            consumed: groupTotals(exp, shares).consumed.get(id) ?? 0,
            member: money.members.some((m) => m.groupId === g.id && m.personId === id),
          }
        })
        .filter((x) => x.member || x.balance !== 0),
    [money, id],
  )

  if (!ready) return <Screen back title="">{null}</Screen>
  if (!person) {
    return (
      <Screen back title="Persona">
        <Empty text="Esta persona ya no existe." />
      </Screen>
    )
  }

  const remove = () =>
    Alert.alert(
      `¿Quitar a ${person.name}?`,
      'Si tiene historial se archiva: deja de salir al apuntar, pero sus trozos, copas y gastos siguen contando. Si no tiene nada, se borra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            const res = await removePerson(person.id)
            toast(res === 'deleted' ? `${person.name} borrado` : `${person.name} archivado`)
            if (res === 'deleted') router.back()
          },
        },
      ],
    )

  const typeName = (tid: string) => types.find((t) => t.id === tid)?.name ?? '¿?'

  return (
    <Screen
      back
      title={person.name}
      subtitle={person.archivedAt ? 'Ya no viene (archivado)' : undefined}
      padded={false}
      right={<Button title="Renombrar" kind="ghost" small onPress={() => setRenaming(true)} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Txt variant="label" tone="muted">
            Sushi
          </Txt>
          {s ? (
            <>
              <Row label="Sesiones" value={String(s.sessions)} />
              <Row label="Trozos en total" value={String(s.total)} />
              <Row label="Media por sesión" value={(Math.round(s.average * 10) / 10).toString().replace('.', ',')} />
              <Row label="Mejor día" value={String(s.best)} />
              <View style={[styles.sep, { borderTopColor: palette.line }]} />
              {lastSushi.map(({ e, session }) => (
                <Row key={e.id} label={`${session!.place ?? 'Buffet'} · ${relativeDay(session!.date)}`} value={String(e.pieces)} />
              ))}
            </>
          ) : (
            <Txt variant="small" tone="muted">
              Todavía no ha ido a ningún buffet.
            </Txt>
          )}
        </Card>

        <Card>
          <Txt variant="label" tone="muted">
            Bebida
          </Txt>
          {d ? (
            <>
              <Row label="Sesiones" value={String(d.sessions)} />
              <Row label="Total" value={String(d.total)} />
              <Row label="Mejor noche" value={String(d.best)} />
              <View style={[styles.sep, { borderTopColor: palette.line }]} />
              {[...d.byType]
                .filter(([, n]) => n > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([tid, n]) => (
                  <Row key={tid} label={typeName(tid)} value={String(n)} />
                ))}
            </>
          ) : (
            <Txt variant="small" tone="muted">
              Nada apuntado.
            </Txt>
          )}
        </Card>

        <Card>
          <Txt variant="label" tone="muted">
            Gastos
          </Txt>
          {groups.length ? (
            groups.map((g) => (
              <View key={g.group.id} style={styles.group}>
                <Row
                  label={g.group.name + (g.group.archivedAt ? ' (archivado)' : '')}
                  value={g.balance === 0 ? 'en paz' : formatMoney(g.balance, { sign: true })}
                  tone={g.balance > 0 ? 'credit' : g.balance < 0 ? 'debt' : 'fg'}
                />
                <Txt variant="data" tone="faint">
                  le ha tocado {formatMoney(g.consumed)}
                </Txt>
              </View>
            ))
          ) : (
            <Txt variant="small" tone="muted">
              No está en ningún grupo de gastos.
            </Txt>
          )}
        </Card>

        <View style={[styles.footer, { borderTopColor: palette.line }]}>
          {person.archivedAt ? (
            <Button title="Vuelve a venir" onPress={() => setPersonArchived(person.id, false)} />
          ) : (
            <Button title="Quitar de la cuadrilla" kind="danger" onPress={remove} />
          )}
        </View>
      </ScrollView>

      <Prompt
        visible={renaming}
        title="Renombrar"
        initial={person.name}
        onCancel={() => setRenaming(false)}
        onSubmit={async (text) => {
          await renamePerson(person.id, text)
          setRenaming(false)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  sep: { borderTopWidth: StyleSheet.hairlineWidth },
  group: { gap: space.xs },
  footer: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
})
