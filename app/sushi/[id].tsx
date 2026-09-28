import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { StepButton } from '../../src/ui/Stepper'
import { Prompt } from '../../src/ui/Prompt'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius, space } from '../../src/ui/theme'
import { AttendeePicker } from '../../src/components/AttendeePicker'
import { useSushi, useSushiSession, usePeopleById } from '../../src/hooks/useData'
import {
  addPieces,
  setPieces,
  addSushiAttendee,
  removeSushiAttendee,
  deleteSushiSession,
  sushiStatsByPerson,
} from '../../src/lib/sushi'
import { rank } from '../../src/lib/ranking'
import { byName } from '../../src/lib/people'
import { longDate } from '../../src/lib/dates'
import type { SushiEntry } from '../../src/types'

export default function SushiSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = useSushiSession(id)
  const { data } = useSushi()
  const people = usePeopleById()
  const palette = usePalette()
  const [editing, setEditing] = useState<SushiEntry | null>(null)
  const [adding, setAdding] = useState(false)

  const entries = useMemo(
    // Orden alfabético FIJO, no por trozos: si la lista se reordenara con cada
    // toque, la tarjeta se movería justo debajo del dedo y el siguiente «+1»
    // caería en otra persona.
    () =>
      data.entries
        .filter((e) => e.sessionId === id)
        .map((e) => ({ entry: e, name: people.get(e.personId)?.name ?? '¿?' }))
        .sort(byName),
    [data.entries, id, people],
  )
  const positions = useMemo(() => {
    const m = new Map<string, number | undefined>()
    for (const r of rank(entries, (x) => x.entry.pieces)) m.set(r.item.entry.id, r.position)
    return m
  }, [entries])
  // La media de cada uno ANTES de hoy, para saber si va por encima.
  const history = useMemo(
    () => sushiStatsByPerson(data.entries.filter((e) => e.sessionId !== id)),
    [data.entries, id],
  )
  const total = entries.reduce((s, x) => s + x.entry.pieces, 0)
  const present = useMemo(() => new Set(entries.map((x) => x.entry.personId)), [entries])

  if (session === undefined) return <Screen back title="">{null}</Screen>
  if (session === null) {
    return (
      <Screen back title="Sesión">
        <Empty text="Esta sesión ya no existe." />
      </Screen>
    )
  }

  const remove = (e: SushiEntry, name: string) =>
    Alert.alert(`¿Quitar a ${name}?`, e.pieces ? `Se pierden sus ${e.pieces} trozos de esta sesión.` : undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => removeSushiAttendee(e.sessionId, e.personId) },
    ])

  const destroy = () =>
    Alert.alert('¿Borrar la sesión?', 'Se borran los trozos de todos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteSushiSession(session.id)
          router.back()
        },
      },
    ])

  return (
    <Screen
      back
      title={session.place ?? 'Buffet'}
      subtitle={longDate(session.date)}
      padded={false}
      right={<Button title="Editar" kind="ghost" small onPress={() => router.push(`/sushi/edit?id=${session.id}`)} />}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.total}>
          <Txt variant="label" tone="muted">
            Total de la mesa
          </Txt>
          <Txt variant="counter">{total}</Txt>
        </View>
        {session.note ? (
          <Txt variant="small" tone="muted">
            {session.note}
          </Txt>
        ) : null}

        {entries.length === 0 ? (
          <Txt variant="body" tone="muted">
            Nadie apuntado todavía. Añade a quien haya venido.
          </Txt>
        ) : null}

        {entries.map(({ entry: e, name }) => {
          const pos = positions.get(e.id)
          const avg = history.get(e.personId)?.average
          return (
            <Card key={e.id} onLongPress={() => remove(e, name)} style={styles.card}>
              <View style={styles.who}>
                <View style={{ flex: 1 }}>
                  <Txt variant="section" numberOfLines={1}>
                    {pos ? `${name} · ${pos}º` : name}
                  </Txt>
                  <Txt variant="data" tone="faint">
                    {avg === undefined ? 'primera vez' : `su media: ${Math.round(avg)}`}
                  </Txt>
                </View>
              </View>
              <View style={styles.counterRow}>
                <StepButton label="−" onPress={() => addPieces(e.id, -1)} disabled={e.pieces <= 0} />
                <Pressable
                  onPress={() => setEditing(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.pieces} trozos, tocar para corregir`}
                  style={({ pressed }) => [
                    styles.number,
                    { borderColor: palette.line, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Txt variant="counter">{e.pieces}</Txt>
                </Pressable>
                <StepButton label="+" size="lg" primary onPress={() => addPieces(e.id, 1)} />
              </View>
            </Card>
          )
        })}

        {entries.length ? (
          <Txt variant="small" tone="faint">
            Toca el número para corregirlo. Mantén pulsada una tarjeta para quitar a esa persona.
          </Txt>
        ) : null}

        <Label>¿Alguien más?</Label>
        {adding ? (
          <AttendeePicker
            label="Toca para añadir"
            selected={new Set()}
            exclude={present}
            onChange={(next) => {
              for (const personId of next) addSushiAttendee(session.id, personId)
            }}
          />
        ) : (
          <Button title="Añadir gente" onPress={() => setAdding(true)} />
        )}

        <View style={[styles.danger, { borderTopColor: palette.line }]}>
          <Button title="Borrar sesión" kind="danger" onPress={destroy} />
        </View>
      </ScrollView>

      <Prompt
        visible={editing !== null}
        title={editing ? `Trozos de ${people.get(editing.personId)?.name ?? ''}` : ''}
        initial={editing ? String(editing.pieces) : ''}
        keyboardType="number-pad"
        onCancel={() => setEditing(null)}
        onSubmit={async (text) => {
          const n = Number(text.trim())
          if (!Number.isInteger(n) || n < 0) throw new Error('Tiene que ser un número entero, 0 o más.')
          await setPieces(editing!.id, n)
          setEditing(null)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  total: { alignItems: 'center', paddingVertical: space.sm },
  card: { gap: space.md },
  who: { flexDirection: 'row', alignItems: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  number: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: space.xs,
  },
  danger: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
})
