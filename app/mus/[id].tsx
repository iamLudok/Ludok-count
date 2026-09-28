import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { StepButton } from '../../src/ui/Stepper'
import { Prompt } from '../../src/ui/Prompt'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius, space } from '../../src/ui/theme'
import { useMusMatch, usePeopleById } from '../../src/hooks/useData'
import { addMusPoint, setMusScore, reopenMusMatch, deleteMusMatch } from '../../src/lib/mus'
import { longDate } from '../../src/lib/dates'

export default function MusMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const match = useMusMatch(id)
  const people = usePeopleById()
  const palette = usePalette()
  const [editing, setEditing] = useState<1 | 2 | null>(null)

  if (match === undefined) return <Screen back title="">{null}</Screen>
  if (match === null) {
    return (
      <Screen back title="Partida">
        <Empty text="Esta partida ya no existe." />
      </Screen>
    )
  }

  const name = (pid: string) => people.get(pid)?.name ?? '¿?'
  const finished = match.winner !== undefined

  const destroy = () =>
    Alert.alert('¿Borrar la partida?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteMusMatch(match.id)
          router.back()
        },
      },
    ])

  const Team = ({ team }: { team: 1 | 2 }) => {
    const p1 = team === 1 ? match.team1Player1 : match.team2Player1
    const p2 = team === 1 ? match.team1Player2 : match.team2Player2
    const score = team === 1 ? match.team1Score : match.team2Score
    const won = match.winner === team
    return (
      <View style={styles.team}>
        <View style={styles.names}>
          <Txt variant="section" numberOfLines={1} style={{ fontWeight: won ? '700' : '500' }}>
            {name(p1)}
          </Txt>
          <Txt variant="section" numberOfLines={1} style={{ fontWeight: won ? '700' : '500' }}>
            {name(p2)}
          </Txt>
        </View>
        <StepButton label="+1" size="lg" primary onPress={() => addMusPoint(match.id, team, 1)} disabled={finished} />
        <Pressable
          onPress={() => setEditing(team)}
          accessibilityRole="button"
          accessibilityLabel={`${score} piedras, tocar para corregir`}
          style={({ pressed }) => [
            styles.score,
            { borderColor: won ? palette.fg : palette.line, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Txt variant="counter" style={styles.scoreNum}>
            {score}
          </Txt>
        </Pressable>
        {won ? (
          <Txt variant="label" style={{ textAlign: 'center' }}>
            Ganaron
          </Txt>
        ) : (
          // Solo para deshacer un toque de más: no se deja bajar de 0 ni tocar
          // una partida ya cerrada, igual que el «+1».
          <StepButton label="−1" onPress={() => addMusPoint(match.id, team, -1)} disabled={finished || score <= 0} />
        )}
      </View>
    )
  }

  return (
    <Screen
      back
      title="Mus"
      subtitle={`${longDate(match.date)} · a ${match.target}`}
      padded={false}
      right={<Button title="Editar" kind="ghost" small onPress={() => router.push(`/mus/edit?id=${match.id}`)} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.board}>
          <Team team={1} />
          <View style={styles.vsWrap}>
            <Txt variant="label" tone="faint">
              vs
            </Txt>
          </View>
          <Team team={2} />
        </View>

        {match.note ? (
          <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {match.note}
          </Txt>
        ) : null}

        <Txt variant="small" tone="faint" style={{ textAlign: 'center' }}>
          Toca un número para corregirlo.
        </Txt>

        <View style={[styles.footer, { borderTopColor: palette.line }]}>
          {finished ? <Button title="Reabrir partida" onPress={() => reopenMusMatch(match.id)} /> : null}
          <Button title="Borrar partida" kind="danger" onPress={destroy} />
        </View>
      </ScrollView>

      <Prompt
        visible={editing !== null}
        title={editing ? `Piedras de la pareja ${editing}` : ''}
        initial={editing ? String(editing === 1 ? match.team1Score : match.team2Score) : ''}
        keyboardType="number-pad"
        onCancel={() => setEditing(null)}
        onSubmit={async (text) => {
          const n = Number(text.trim())
          if (!Number.isInteger(n) || n < 0) throw new Error('Tiene que ser un número entero, 0 o más.')
          await setMusScore(match.id, editing!, n)
          setEditing(null)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  board: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  vsWrap: { paddingHorizontal: space.xs },
  team: { flex: 1, alignItems: 'center', gap: space.md },
  names: { alignItems: 'center', gap: 2 },
  score: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
  scoreNum: { fontSize: 44 },
  footer: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
})
