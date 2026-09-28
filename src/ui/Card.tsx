import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'

/** Superficie elevada. Con `onPress` se puede tocar entera (filas de listas). */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
}: {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: ViewStyle
}) {
  const palette = usePalette()
  const base = [styles.card, { backgroundColor: palette.surface, borderColor: palette.line }, style]
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => [...base, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  )
}

/** Etiqueta de sección, en versalitas pequeñas. */
export function Label({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.label, style]}>
      <Txt variant="label" tone="muted">
        {children}
      </Txt>
    </View>
  )
}

/** Fila «etiqueta ····· valor» dentro de una tarjeta. */
export function Row({ label, value, tone }: { label: string; value: string; tone?: 'credit' | 'debt' | 'fg' }) {
  return (
    <View style={styles.row}>
      <Txt variant="small" tone="muted" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt variant="data" tone={tone ?? 'fg'}>
        {value}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  label: { paddingTop: space.md, paddingBottom: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
})
