import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { Chips } from '../../src/ui/Chips'
import { space } from '../../src/ui/theme'
import { useMus, usePeopleById } from '../../src/hooks/useData'
import { musStatsByPerson, ongoingMusMatches, finishedMusMatches } from '../../src/lib/mus'
import { rank } from '../../src/lib/ranking'
import { relativeDay } from '../../src/lib/dates'
import { Ranking } from '../../src/components/Ranking'
import { BackupBanner } from '../../src/components/BackupBanner'

type Metric = 'wins' | 'winRate' | 'matches'
const METRICS = [
  { key: 'wins' as const, label: 'Ganadas' },
  { key: 'winRate' as const, label: '% victorias' },
  { key: 'matches' as const, label: 'Jugadas' },
]

export default function MusScreen() {
  const { data: matches, ready } = useMus()
  const people = usePeopleById()
  const [metric, setMetric] = useState<Metric>('wins')

  const ongoing = useMemo(() => ongoingMusMatches(matches), [matches])
  const finished = useMemo(() => finishedMusMatches(matches), [matches])
  const stats = useMemo(() => [...musStatsByPerson(matches).values()], [matches])

  const ranking = useMemo(() => {
    const value = (s: (typeof stats)[number]) => (metric === 'winRate' ? Math.round(s.winRate * 100) : s[metric])
    const ranked = rank(stats, value)
    const top = ranked[0]?.value || 1
    return ranked.map(({ item: s, value, position }) => ({
      key: s.personId,
      name: people.get(s.personId)?.name ?? '¿?',
      value: metric === 'winRate' ? `${value} %` : String(value),
      detail: `${s.wins} ganadas de ${s.matches}`,
      position,
      share: value / top,
    }))
  }, [stats, metric, people])

  const name = (pid: string) => people.get(pid)?.name ?? '¿?'
  const teamNames = (p1: string, p2: string) => `${name(p1)} y ${name(p2)}`

  return (
    <Screen
      title="Mus"
      padded={false}
      right={<Button title="Nueva" kind="primary" small onPress={() => router.push('/mus/edit')} />}
    >
      {!ready ? null : matches.length === 0 ? (
        <Empty text="Sin partidas todavía. Elegid las dos parejas y llevad el tanteo desde el móvil.">
          <Button title="Nueva partida" kind="primary" onPress={() => router.push('/mus/edit')} />
        </Empty>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BackupBanner itemCount={matches.length} />

          {ongoing.length ? (
            <>
              <Label>En juego</Label>
              {ongoing.map((m) => (
                <Card key={m.id} onPress={() => router.push(`/mus/${m.id}`)} style={styles.item}>
                  <View style={styles.itemHead}>
                    <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
                      {teamNames(m.team1Player1, m.team1Player2)}
                    </Txt>
                    <Txt variant="amount">{m.team1Score}</Txt>
                  </View>
                  <View style={styles.itemHead}>
                    <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
                      {teamNames(m.team2Player1, m.team2Player2)}
                    </Txt>
                    <Txt variant="amount">{m.team2Score}</Txt>
                  </View>
                  <Txt variant="small" tone="muted">
                    a {m.target} · {relativeDay(m.date)}
                  </Txt>
                </Card>
              ))}
            </>
          ) : null}

          <Card>
            <Txt variant="label" tone="muted">
              Clasificación
            </Txt>
            <Chips options={METRICS} value={metric} onChange={setMetric} />
            {ranking.length ? (
              <Ranking rows={ranking} />
            ) : (
              <Txt variant="small" tone="muted">
                Todavía no hay ninguna partida cerrada.
              </Txt>
            )}
          </Card>

          <Label>Historial</Label>
          {finished.length === 0 ? (
            <Txt variant="body" tone="muted">
              Ninguna partida cerrada aún.
            </Txt>
          ) : (
            finished.map((m) => {
              const winners = m.winner === 1 ? [m.team1Player1, m.team1Player2] : [m.team2Player1, m.team2Player2]
              const losers = m.winner === 1 ? [m.team2Player1, m.team2Player2] : [m.team1Player1, m.team1Player2]
              const winScore = m.winner === 1 ? m.team1Score : m.team2Score
              const loseScore = m.winner === 1 ? m.team2Score : m.team1Score
              return (
                <Card key={m.id} onPress={() => router.push(`/mus/${m.id}`)} style={styles.item}>
                  <Txt variant="section" numberOfLines={1}>
                    {teamNames(winners[0], winners[1])} <Txt variant="section" tone="muted">ganaron</Txt>
                  </Txt>
                  <Txt variant="small" tone="muted">
                    {winScore}-{loseScore} a {teamNames(losers[0], losers[1])} · {relativeDay(m.date)}
                  </Txt>
                </Card>
              )
            })
          )}
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
