import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../src/ui/Screen'
import { Button } from '../../src/ui/Button'
import { Field } from '../../src/ui/Field'
import { DateField } from '../../src/ui/DateField'
import { space } from '../../src/ui/theme'
import { AttendeePicker } from '../../src/components/AttendeePicker'
import { useSushiSession } from '../../src/hooks/useData'
import { createSushiSession, updateSushiSession } from '../../src/lib/sushi'

/**
 * Nueva sesión de sushi, o editar la fecha y el sitio de una existente
 * (`?id=`). Al editar no se tocan los asistentes: eso se hace en la propia
 * sesión, que es donde se ve quién está.
 */
export default function SushiSessionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const existing = useSushiSession(id)
  const [date, setDate] = useState(Date.now())
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [who, setWho] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setPlace(existing.place ?? '')
    setNote(existing.note ?? '')
  }, [existing])

  const save = async () => {
    setBusy(true)
    try {
      if (id) {
        await updateSushiSession(id, { date, place, note })
        router.back()
      } else {
        const newId = await createSushiSession({ date, place, note }, [...who])
        // replace y no push: al volver desde la sesión, se vuelve a la lista,
        // no a este formulario ya usado.
        router.replace(`/sushi/${newId}`)
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={id ? 'Editar sesión' : 'Nueva sesión de sushi'} back padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DateField label="Día" value={date} onChange={setDate} />
        <Field label="Sitio" value={place} onChangeText={setPlace} placeholder="Nombre del buffet" />
        <Field label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" />
        {id ? null : <AttendeePicker selected={who} onChange={setWho} />}
        <Button
          title={id ? 'Guardar' : who.size ? 'Empezar a contar' : 'Crear sin gente'}
          kind="primary"
          onPress={save}
          disabled={busy || (!!id && !existing)}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
})
