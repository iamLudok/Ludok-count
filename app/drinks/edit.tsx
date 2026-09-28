import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../src/ui/Screen'
import { Button } from '../../src/ui/Button'
import { Field } from '../../src/ui/Field'
import { DateField } from '../../src/ui/DateField'
import { space } from '../../src/ui/theme'
import { AttendeePicker } from '../../src/components/AttendeePicker'
import { useDrinkSession } from '../../src/hooks/useData'
import { createDrinkSession, updateDrinkSession } from '../../src/lib/drinks'

/** Nueva sesión de bebida, o editar título, sitio y fecha de una (`?id=`). */
export default function DrinkSessionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const existing = useDrinkSession(id)
  const [date, setDate] = useState(Date.now())
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [who, setWho] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setTitle(existing.title ?? '')
    setPlace(existing.place ?? '')
  }, [existing])

  const save = async () => {
    setBusy(true)
    try {
      if (id) {
        await updateDrinkSession(id, { date, title, place })
        router.back()
      } else {
        const newId = await createDrinkSession({ date, title, place }, [...who])
        router.replace(`/drinks/${newId}`)
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={id ? 'Editar sesión' : 'Nueva sesión de bebida'} back padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Título"
          value={title}
          onChangeText={setTitle}
          placeholder="Ronda de chupitos, fiestas de Bilbo…"
        />
        <DateField label="Día" value={date} onChange={setDate} />
        <Field label="Sitio" value={place} onChangeText={setPlace} placeholder="Opcional" />
        {id ? null : <AttendeePicker label="Quién está" selected={who} onChange={setWho} />}
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
