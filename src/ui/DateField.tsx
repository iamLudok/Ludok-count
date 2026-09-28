import { useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'
import { longDate, relativeDay } from '../lib/dates'

/**
 * Fecha de una sesión o un gasto, con el selector del sistema. Sirve sobre
 * todo para apuntar cosas pasadas: el buffet del sábado, apuntado el lunes.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label?: string
  value: number
  onChange: (ms: number) => void
}) {
  const palette = usePalette()
  const [picking, setPicking] = useState(false)

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    // En Android el diálogo se cierra solo; hay que quitarlo del árbol o no
    // se puede volver a abrir.
    if (Platform.OS !== 'ios') setPicking(false)
    if (event.type === 'dismissed' || !date) return
    // Se cambia solo el día y se conserva la hora que tuviera: con la hora
    // puesta a mano, dos sesiones del mismo día dejaban de salir en el orden
    // en que se apuntaron.
    const next = new Date(value)
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    onChange(next.getTime())
  }

  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" tone="muted">
          {label}
        </Txt>
      ) : null}
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.box,
          { borderColor: palette.line, backgroundColor: palette.surface, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Txt variant="body">{longDate(value)}</Txt>
        <Txt variant="small" tone="muted">
          {relativeDay(value)}
        </Txt>
      </Pressable>
      {picking && (
        <DateTimePicker
          mode="date"
          display="default"
          value={new Date(value)}
          maximumDate={new Date()}
          onChange={onPicked}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  box: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
})
