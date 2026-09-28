import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { Chips } from '../../src/ui/Chips'
import { space } from '../../src/ui/theme'
import { useSushi, usePeopleById } from '../../src/hooks/useData'
import { sushiStatsByPerson, summarizeSushiSessions, sushiRecord } from '../../src/lib/sushi'
import { rank } from '../../src/lib/ranking'
import { relativeDay } from '../../src/lib/dates'
import { Ranking } from '../../src/components/Ranking'
import { BackupBanner } from '../../src/components/BackupBanner'

type Metric = 'average' | 'total' | 'best'
const METRICS = [
  { key: 'average' as const, label: 'Media' },
  { key: 'total' as const, label: 'Total' },
  { key: 'best' as const, label: 'Mejor día' },
]

const fmtAvg = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

export default function SushiScreen() {
  const { data, ready } = useSushi()
  const people = usePeopleById()
  const [metric, setMetric] = useState<Metric>('average')

  const stats = useMemo(() => [...sushiStatsByPerson(data.entries).values()], [data.entries])
  const summary = useMemo(() => summarizeSushiSessions(data.sessions, data.entries), [data])
  const record = useMemo(() => sushiRecord(data.entries), [data.entries])

  const ranking = useMemo(() => {
    const ranked = rank(stats, (s) => s[metric])
    const top = ranked[0]?.value || 1
    return ranked.map(({ item: s, value, position }) => ({
      key: s.personId,
      name: people.get(s.personId)?.name ?? '¿?',
      value: metric === 'average' ? fmtAvg(value) : String(value),
      detail: `${s.sessions} ${s.sessions === 1 ? 'sesión' : 'sesiones'} · ${s.total} en total`,
      position,
      share: value / top,
    }))
  }, [stats, metric, people])

  const nameList = (ids: string[]) => ids.map((id) => people.get(id)?.name ?? '¿?').join(' y ')

  return (
    <Screen
      title="Sushi"
      padded={false}
      right={<Button title="Nueva" kind="primary" small onPress={() => router.push('/sushi/edit')} />}
    >
      {!ready ? null : data.sessions.length === 0 ? (
        <Empty text="Todavía no hay ningún buffet apuntado. Crea una sesión el día que vayáis y cada uno va sumando trozos.">
          <Button title="Nueva sesión" kind="primary" onPress={() => router.push('/sushi/edit')} />
        </Empty>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BackupBanner itemCount={data.sessions.length} />

          {record ? (
            <Card>
              <Txt variant="label" tone="muted">
                Récord
              </Txt>
              <View style={styles.record}>
                <Txt variant="counter">{record.pieces}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="section">{people.get(record.personId)?.name ?? '¿?'}</Txt>
                  <Txt variant="small" tone="muted">
                    trozos en una sola sesión
                  </Txt>
                </View>
              </View>
            </Card>
          ) : null}

          <Card>
            <Txt variant="label" tone="muted">
              Clasificación
            </Txt>
            <Chips options={METRICS} value={metric} onChange={setMetric} />
            <Ranking rows={ranking} />
            {metric === 'average' ? (
              <Txt variant="small" tone="faint">
                La media es por sesión a la que fue cada uno: no ir no baja la media.
              </Txt>
            ) : null}
          </Card>

          <Label>Historial</Label>
          {summary.map((s) => (
            <Card key={s.session.id} onPress={() => router.push(`/sushi/${s.session.id}`)} style={styles.item}>
              <View style={styles.itemHead}>
                <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
                  {s.session.place ?? 'Buffet'}
                </Txt>
                <Txt variant="small" tone="muted">
                  {relativeDay(s.session.date)}
                </Txt>
              </View>
              <Txt variant="small" tone="muted">
                {s.attendees} {s.attendees === 1 ? 'persona' : 'personas'} · {s.total} trozos
                {s.winners.length ? ` · ganó ${nameList(s.winners)} con ${s.top}` : ''}
              </Txt>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  record: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  item: { gap: space.xs, paddingVertical: space.md },
  itemHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
})
