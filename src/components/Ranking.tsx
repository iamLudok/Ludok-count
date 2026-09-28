import { StyleSheet, View } from 'react-native'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { radius, space } from '../ui/theme'

export interface RankingRow {
  key: string
  name: string
  /** La cifra que manda, ya formateada. */
  value: string
  /** Lo que la acompaña: «4 sesiones», «récord 61»… */
  detail?: string
  /** Puesto con empates (1, 1, 3). Sin puesto = no puntúa (0). */
  position?: number
  /** 0–1: largo de la barra, relativo al primero. */
  share: number
}

/**
 * Clasificación con barra. La barra es relativa al primero y no al total:
 * lo que interesa en la mesa es cuánto le falta a cada uno para el que va
 * ganando, no qué porcentaje del buffet se ha comido.
 */
export function Ranking({ rows }: { rows: RankingRow[] }) {
  const palette = usePalette()
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <Txt variant="data" tone={r.position === 1 ? 'fg' : 'faint'} style={styles.pos}>
            {r.position ? `${r.position}º` : '–'}
          </Txt>
          <View style={styles.main}>
            <View style={styles.line}>
              <Txt variant="body" numberOfLines={1} style={{ flexShrink: 1, fontWeight: r.position === 1 ? '700' : '500' }}>
                {r.name}
              </Txt>
              <Txt variant="amount">{r.value}</Txt>
            </View>
            <View style={[styles.track, { backgroundColor: palette.surface2 }]}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: r.position === 1 ? palette.fg : palette.muted, width: `${Math.round(r.share * 100)}%` },
                ]}
              />
            </View>
            {r.detail ? (
              <Txt variant="data" tone="faint">
                {r.detail}
              </Txt>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pos: { width: 28, paddingTop: 2 },
  main: { flex: 1, gap: space.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: 4, borderRadius: radius.pill },
})
