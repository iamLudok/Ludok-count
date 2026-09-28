import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { Chips } from '../../src/ui/Chips'
import { space } from '../../src/ui/theme'
import { useDrinks, useDrinkTypes, usePeopleById } from '../../src/hooks/useData'
import { drinkStatsByPerson, summarizeDrinkSessions } from '../../src/lib/drinks'
import { rank } from '../../src/lib/ranking'
import { relativeDay } from '../../src/lib/dates'
import { Ranking } from '../../src/components/Ranking'
import { BackupBanner } from '../../src/components/BackupBanner'

const ALL = '__todo'

export default function DrinksScreen() {
  const { data, ready } = useDrinks()
  const { data: types } = useDrinkTypes()
  const people = usePeopleById()
  const [filter, setFilter] = useState<string>(ALL)

  const stats = useMemo(() => [...drinkStatsByPerson(data.entries, data.counts).values()], [data])
  const summary = useMemo(() => summarizeDrinkSessions(data.sessions, data.entries, data.counts), [data])
  // Solo los tipos que alguien ha bebido alguna vez: un filtro «Vino» con
  // todos a cero no aporta nada.
  const usedTypes = useMemo(() => {
    const used = new Set(data.counts.filter((c) => c.count > 0).map((c) => c.typeId))
    return types.filter((t) => used.has(t.id))
  }, [types, data.counts])

  const ranking = useMemo(() => {
    const value = (s: (typeof stats)[number]) => (filter === ALL ? s.total : s.byType.get(filter) ?? 0)
    const ranked = rank(stats, value)
    const top = ranked[0]?.value || 1
    return ranked.map(({ item: s, value: v, position }) => ({
      key: s.personId,
      name: people.get(s.personId)?.name ?? '¿?',
      value: String(v),
      detail: `${s.sessions} ${s.sessions === 1 ? 'sesión' : 'sesiones'} · mejor noche: ${s.best}`,
      position,
      share: v / top,
    }))
  }, [stats, filter, people])

  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? '¿?'
  const nameList = (ids: string[]) => ids.map((id) => people.get(id)?.name ?? '¿?').join(' y ')

  return (
    <Screen
      title="Bebida"
      padded={false}
      right={<Button title="Nueva" kind="primary" small onPress={() => router.push('/drinks/edit')} />}
    >
      {!ready ? null : data.sessions.length === 0 ? (
        <Empty text="Ni una ronda apuntada. Crea una sesión cuando salgáis y ve sumando lo que cae.">
          <Button title="Nueva sesión" kind="primary" onPress={() => router.push('/drinks/edit')} />
        </Empty>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BackupBanner itemCount={data.sessions.length} />

          <Card>
            <Txt variant="label" tone="muted">
              Clasificación histórica
            </Txt>
            <Chips
              options={[{ key: ALL, label: 'Todo' }, ...usedTypes.map((t) => ({ key: t.id, label: t.name }))]}
              value={filter}
              onChange={setFilter}
            />
            <Ranking rows={ranking} />
          </Card>

          <Label>Historial</Label>
          {summary.map((s) => (
            <Card key={s.session.id} onPress={() => router.push(`/drinks/${s.session.id}`)} style={styles.item}>
              <View style={styles.itemHead}>
                <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
                  {s.session.title ?? s.session.place ?? 'Noche'}
                </Txt>
                <Txt variant="small" tone="muted">
                  {relativeDay(s.session.date)}
                </Txt>
              </View>
              <Txt variant="small" tone="muted">
                {s.attendees} {s.attendees === 1 ? 'persona' : 'personas'} · {s.total}{' '}
                {s.total === 1 ? 'bebida' : 'bebidas'}
                {s.winners.length ? ` · ganó ${nameList(s.winners)} con ${s.top}` : ''}
              </Txt>
            </Card>
          ))}
          {filter !== ALL ? (
            <Txt variant="small" tone="faint">
              Mostrando solo {typeName(filter).toLowerCase()} en la clasificación.
            </Txt>
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
