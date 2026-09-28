import { Pressable, StyleSheet, View } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'

/**
 * Botón cuadrado de sumar/restar. El «+» es sólido y grande porque es el que
 * se pulsa cien veces con los palillos en la otra mano; el «−» solo lleva
 * borde, para que no se confundan de un vistazo.
 */
export function StepButton({
  label,
  onPress,
  primary,
  size = 'md',
  disabled,
}: {
  label: string
  onPress: () => void
  primary?: boolean
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}) {
  const palette = usePalette()
  const dim = size === 'lg' ? 64 : size === 'md' ? 44 : 32
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Restar uno' : label === '+' ? 'Sumar uno' : label}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.btn,
        {
          width: dim,
          height: dim,
          backgroundColor: primary ? palette.fg : 'transparent',
          borderColor: primary ? palette.fg : palette.line,
          opacity: disabled ? 0.3 : pressed ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Txt
        variant={size === 'lg' ? 'title' : size === 'md' ? 'section' : 'body'}
        style={{ color: primary ? palette.onFg : palette.fg, fontWeight: '700' }}
      >
        {label}
      </Txt>
    </Pressable>
  )
}

/** «− 3 +» en línea, compacto (los tipos de bebida). */
export function InlineStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (delta: number) => void
}) {
  return (
    <View style={styles.inline}>
      <StepButton label="−" size="sm" onPress={() => onChange(-1)} disabled={value <= 0} />
      <Txt variant="amount" style={styles.value}>
        {value}
      </Txt>
      <StepButton label="+" size="sm" primary onPress={() => onChange(1)} />
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { minWidth: 28, textAlign: 'center' },
})
