import { useState } from 'react'
import { ScrollView, View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { updateSettings } from '../lib/settings'
import { addPeople } from '../lib/people'
import { pickJsonFile, importBackup } from '../lib/backup'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { radius, space } from '../ui/theme'

/**
 * Bienvenida en la primera apertura.
 *
 * Todo en la app gira alrededor de la gente: sin nadie dado de alta, las
 * pantallas de sushi, bebida y gastos no tienen a quién apuntar nada. Por eso
 * lo primero es meter a la cuadrilla, de golpe y en un solo campo. También se
 * ofrece restaurar una copia, que es como llega quien cambia de móvil.
 */
export function Welcome() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [names, setNames] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Guardar `onboardedAt` basta: la pantalla que muestra esto lee los ajustes
  // con una consulta reactiva y desaparece sola.
  const finish = () => updateSettings({ onboardedAt: Date.now() })

  const start = async () => {
    setBusy(true)
    try {
      // Los repetidos se saltan sin avisar: el resultado es el mismo que si se
      // hubieran escrito una sola vez.
      const { added } = await addPeople(names)
      if (!added.length) {
        setMessage('No se ha podido añadir a nadie. Revisa los nombres.')
        return
      }
      await finish()
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const raw = await pickJsonFile()
      if (!raw) return
      // Restaurar ya marca la bienvenida como vista: al volver, se entra.
      await importBackup(raw, 'replace')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo importar')
    } finally {
      setBusy(false)
    }
  }

  const count = names.split(/[\n,]/).filter((s) => s.trim()).length

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.intro}>
        <Txt variant="display">Ludok Count</Txt>
        <Txt variant="body" tone="muted">
          Los trozos de sushi de cada buffet, las rondas de chupitos y quién le debe cuánto a quién.
          Todo se guarda solo en este móvil: sin cuentas ni servidores.
        </Txt>
      </View>

      <View style={[styles.card, { borderColor: palette.line }]}>
        <Txt variant="section">¿Quiénes sois?</Txt>
        <Txt variant="small" tone="muted">
          Un nombre por línea o separados por comas. Luego se puede añadir, renombrar y quitar gente
          desde la pestaña Cuadrilla.
        </Txt>
        <Field
          value={names}
          onChangeText={setNames}
          placeholder={'Ane\nIker\nMikel'}
          multiline
          autoCapitalize="words"
          style={styles.names}
        />
        <Button
          title={count ? `Empezar con ${count} ${count === 1 ? 'persona' : 'personas'}` : 'Empezar'}
          kind="primary"
          disabled={!count || busy}
          onPress={start}
        />
      </View>

      <View style={[styles.card, { borderColor: palette.line }]}>
        <Txt variant="section">¿Vienes de otro móvil?</Txt>
        <Txt variant="small" tone="muted">
          Si tienes una copia exportada, impórtala y te lo trae todo: gente, sesiones y gastos.
        </Txt>
        <Button title="Importar una copia" onPress={restore} disabled={busy} />
      </View>

      {message ? (
        <Txt variant="small" tone="warn">
          {message}
        </Txt>
      ) : null}

      <Button title="Ahora no, entrar" kind="ghost" disabled={busy} onPress={finish} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: space.lg },
  intro: { gap: space.sm, paddingBottom: space.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  names: { minHeight: 120, textAlignVertical: 'top' },
})
