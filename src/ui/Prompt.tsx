import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View, type KeyboardTypeOptions } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { Field } from './Field'
import { Button } from './Button'
import { radius, space } from './theme'

/**
 * Pregunta con un campo de texto. Existe porque `Alert.prompt` solo funciona
 * en iOS: en Android no hay forma nativa de pedir un número o un nombre en un
 * diálogo, y abrir una pantalla entera para corregir un contador es excesivo.
 */
export function Prompt({
  visible,
  title,
  message,
  initial = '',
  placeholder,
  keyboardType,
  confirm = 'Guardar',
  onCancel,
  onSubmit,
}: {
  visible: boolean
  title: string
  message?: string
  initial?: string
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  confirm?: string
  onCancel: () => void
  /** Si lanza un error, se enseña debajo del campo y el diálogo no se cierra. */
  onSubmit: (text: string) => void | Promise<void>
}) {
  const palette = usePalette()
  const [text, setText] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setText(initial)
      setError(null)
    }
  }, [visible, initial])

  const submit = async () => {
    try {
      await onSubmit(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: palette.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cerrar" />
        <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Txt variant="title">{title}</Txt>
          {message ? (
            <Txt variant="small" tone="muted">
              {message}
            </Txt>
          ) : null}
          <Field
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            keyboardType={keyboardType}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          {error ? (
            <Txt variant="small" tone="danger">
              {error}
            </Txt>
          ) : null}
          <View style={styles.actions}>
            <Button title="Cancelar" kind="ghost" onPress={onCancel} />
            <Button title={confirm} kind="primary" onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.xl },
  box: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
})
