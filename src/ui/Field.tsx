import { forwardRef } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space, type } from './theme'

/** Campo de texto con el aspecto de la app y, si se quiere, su etiqueta encima. */
export const Field = forwardRef<TextInput, TextInputProps & { label?: string }>(function Field(
  { label, style, ...rest },
  ref,
) {
  const palette = usePalette()
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="muted">
          {label}
        </Txt>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={palette.faint}
        {...rest}
        style={[
          styles.input,
          type.body,
          { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface },
          style,
        ]}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
})
