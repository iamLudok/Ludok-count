import { Pressable, StyleSheet, View } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'

export interface PillOption {
  key: string
  label: string
}

/**
 * Selección de varios (o de uno, con `single`) en pastillas que saltan de
 * línea. Es lo que se usa para elegir gente: a diferencia de `Chips`, que se
 * desliza en horizontal, aquí se ve a toda la cuadrilla de un vistazo, que es
 * lo que hace falta al apuntar quién ha venido.
 */
export function Pills({
  options,
  selected,
  onToggle,
  single,
}: {
  options: PillOption[]
  /** Un conjunto de claves, o una sola clave si es de elegir uno. */
  selected: ReadonlySet<string> | string | undefined
  onToggle: (key: string) => void
  single?: boolean
}) {
  const palette = usePalette()
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = typeof selected === 'string' || selected === undefined ? selected === o.key : selected.has(o.key)
        return (
          <Pressable
            key={o.key}
            onPress={() => onToggle(o.key)}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={single ? { selected: on } : { checked: on }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: on ? palette.fg : 'transparent',
                borderColor: on ? palette.fg : palette.line,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Txt variant="body" style={{ color: on ? palette.onFg : palette.fg, fontWeight: '600' }}>
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
})
