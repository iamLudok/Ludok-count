import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { InlineStepper } from '../../src/ui/Stepper'
import { Pills } from '../../src/ui/Pills'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useToast } from '../../src/ui/Toast'
import { space } from '../../src/ui/theme'
import { AttendeePicker } from '../../src/components/AttendeePicker'
import { useDrinks, useDrinkSession, useDrinkTypes, usePeopleById } from '../../src/hooks/useData'
import {
  addDrink,
  addDrinkAttendee,
  removeDrinkAttendee,
  deleteDrinkSession,
  tallyByEntry,
} from '../../src/lib/drinks'
import { rank } from '../../src/lib/ranking'
import { byName } from '../../src/lib/people'
import { longDate } from '../../src/lib/dates'

export default function DrinkSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = useDrinkSession(id)
  const { data } = useDrinks()
  const { data: types } = useDrinkTypes()
  const people = usePeopleById()
  const palette = usePalette()
  const toast = useToast()
  const [adding, setAdding] = useState(false)

  // Orden alfabético fijo, por lo mismo que en el sushi: que nada se mueva
  // debajo del dedo mientras se suma.
  const entries = useMemo(
    () =>
      data.entries
        .filter((e) => e.sessionId === id)
        .map((e) => ({ entry: e, name: people.get(e.personId)?.name ?? '¿?' }))
        .sort(byName),
    [data.entries, id, people],
  )
  const tallies = useMemo(() => {
    const ids = new Set(entries.map((x) => x.entry.id))
    return tallyByEntry(data.counts.filter((c) => ids.has(c.entryId)))
  }, [data.counts, entries])
  const positions = useMemo(() => {
    const m = new Map<string, number | undefined>()
    for (const r of rank(entries, (x) => tallies.get(x.entry.id)?.total ?? 0)) m.set(r.item.entry.id, r.position)
    return m
  }, [entries, tallies])
  const present = useMemo(() => new Set(entries.map((x) => x.entry.personId)), [entries])
  const activeTypes = types.filter((t) => !t.archivedAt)
  const total = [...tallies.values()].reduce((s, t) => s + t.total, 0)

  if (session === undefined) return <Screen back title="">{null}</Screen>
  if (session === null) {
    return (
      <Screen back title="Sesión">
        <Empty text="Esta sesión ya no existe." />
      </Screen>
    )
  }

  /** Una ronda: +1 del tipo elegido para todos los que están. */
  const round = async (typeId: string) => {
    await Promise.all(entries.map((x) => addDrink(x.entry.id, typeId, 1)))
    const t = types.find((t) => t.id === typeId)
    toast(`Ronda de ${t?.name.toLowerCase() ?? 'algo'} para ${entries.length}`)
  }

  const remove = (personId: string, name: string) =>
    Alert.alert(`¿Quitar a ${name}?`, 'Se pierde lo que lleve apuntado en esta sesión.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => removeDrinkAttendee(session.id, personId) },
    ])

  const destroy = () =>
    Alert.alert('¿Borrar la sesión?', 'Se borra lo que haya bebido cada uno. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteDrinkSession(session.id)
          router.back()
        },
      },
    ])

  return (
    <Screen
      back
      title={session.title ?? session.place ?? 'Noche'}
      subtitle={[longDate(session.date), session.title ? session.place : undefined].filter(Boolean).join(' · ')}
      padded={false}
      right={<Button title="Editar" kind="ghost" small onPress={() => router.push(`/drinks/edit?id=${session.id}`)} />}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.total}>
          <Txt variant="label" tone="muted">
            Entre todos
          </Txt>
          <Txt variant="counter">{total}</Txt>
        </View>

        {entries.length > 1 && activeTypes.length ? (
          <Card>
            <Txt variant="label" tone="muted">
              Ronda para todos
            </Txt>
            <Pills
              options={activeTypes.map((t) => ({ key: t.id, label: `+1 ${t.name.toLowerCase()}` }))}
              selected={undefined}
              onToggle={round}
            />
          </Card>
        ) : null}

        {entries.length === 0 ? (
          <Txt variant="body" tone="muted">
            Nadie apuntado todavía. Añade a quien esté.
          </Txt>
        ) : null}

        {entries.map(({ entry: e, name }) => {
          const tally = tallies.get(e.id)
          const pos = positions.get(e.id)
          // Los tipos quitados siguen saliendo si esta persona los bebió aquí:
          // si no, su total no cuadraría con lo que se ve.
          const shown = types.filter((t) => !t.archivedAt || (tally?.byType.get(t.id) ?? 0) > 0)
          return (
            <Card key={e.id} onLongPress={() => remove(e.personId, name)}>
              <View style={styles.who}>
                <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
                  {pos ? `${name} · ${pos}º` : name}
                </Txt>
                <Txt variant="amount">{tally?.total ?? 0}</Txt>
              </View>
              <View style={[styles.types, { borderTopColor: palette.line }]}>
                {shown.map((t) => (
                  <View key={t.id} style={styles.typeRow}>
                    <Txt variant="body" tone={t.archivedAt ? 'faint' : 'fg'} style={{ flex: 1 }}>
                      {t.name}
                    </Txt>
                    <InlineStepper value={tally?.byType.get(t.id) ?? 0} onChange={(d) => addDrink(e.id, t.id, d)} />
                  </View>
                ))}
              </View>
            </Card>
          )
        })}

        {entries.length ? (
          <Txt variant="small" tone="faint">
            Mantén pulsada una tarjeta para quitar a esa persona. Los tipos de bebida se cambian en Ajustes.
          </Txt>
        ) : null}

        <Label>¿Alguien más?</Label>
        {adding ? (
          <AttendeePicker
            label="Toca para añadir"
            selected={new Set()}
            exclude={present}
            onChange={(next) => {
              for (const personId of next) addDrinkAttendee(session.id, personId)
            }}
          />
        ) : (
          <Button title="Añadir gente" onPress={() => setAdding(true)} />
        )}

        <View style={[styles.danger, { borderTopColor: palette.line }]}>
          <Button title="Borrar sesión" kind="danger" onPress={destroy} />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  total: { alignItems: 'center', paddingVertical: space.sm },
  who: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  types: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  danger: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
})
