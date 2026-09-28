import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Field } from '../../src/ui/Field'
import { Pills } from '../../src/ui/Pills'
import { DateField } from '../../src/ui/DateField'
import { space } from '../../src/ui/theme'
import { usePeople, useMusMatch } from '../../src/hooks/useData'
import { createMusMatch, updateMusMatch, DEFAULT_MUS_TARGET } from '../../src/lib/mus'

/**
 * Nueva partida de mus (eligiendo las dos parejas), o editar fecha, meta y
 * nota de una existente (`?id=`). Las parejas no se pueden cambiar una vez
 * creada la partida: si os habéis equivocado, se borra y se crea otra.
 */
export default function MusMatchForm() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const existing = useMusMatch(id)
  const { data: people, ready } = usePeople()

  const [date, setDate] = useState(Date.now())
  const [target, setTarget] = useState(String(DEFAULT_MUS_TARGET))
  const [note, setNote] = useState('')
  const [team1, setTeam1] = useState<Set<string>>(new Set())
  const [team2, setTeam2] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setTarget(String(existing.target))
    setNote(existing.note ?? '')
  }, [existing])

  if (!id && ready && people.filter((p) => !p.archivedAt).length < 4) {
    return (
      <Screen title="Nueva partida de mus" back>
        <Empty text="Hacen falta al menos cuatro personas en la cuadrilla para jugar por parejas." />
      </Screen>
    )
  }

  const active = people.filter((p) => !p.archivedAt)
  const inTeam1 = (pid: string) => team1.has(pid)
  const inTeam2 = (pid: string) => team2.has(pid)

  const toggleTeam = (team: 1 | 2) => (pid: string) => {
    const mine = team === 1 ? team1 : team2
    const setMine = team === 1 ? setTeam1 : setTeam2
    const next = new Set(mine)
    if (next.has(pid)) {
      next.delete(pid)
    } else {
      // Como mucho dos por pareja: si ya está completa, tocar a un tercero no hace nada.
      if (next.size >= 2) return
      next.add(pid)
    }
    setMine(next)
  }

  const save = async () => {
    const t = Number(target.trim())
    if (!Number.isInteger(t) || t < 1) return Alert.alert('Meta no válida', 'Pon un número entero mayor que 0.')
    setBusy(true)
    try {
      if (id) {
        await updateMusMatch(id, { date, target: t, note })
        router.back()
      } else {
        if (team1.size !== 2 || team2.size !== 2) {
          Alert.alert('Faltan jugadores', 'Cada pareja necesita exactamente dos personas.')
          return
        }
        const [a, b] = [...team1] as [string, string]
        const [c, d] = [...team2] as [string, string]
        const newId = await createMusMatch({ date, target: t, note, team1: [a, b], team2: [c, d] })
        router.replace(`/mus/${newId}`)
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  const canSave = id ? true : team1.size === 2 && team2.size === 2

  return (
    <Screen title={id ? 'Editar partida' : 'Nueva partida de mus'} back padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DateField label="Día" value={date} onChange={setDate} />
        <Field label="Piedras para ganar" value={target} onChangeText={setTarget} keyboardType="number-pad" />

        {!id ? (
          <>
            <View style={styles.team}>
              <Txt variant="label" tone="muted">
                Pareja 1{team1.size ? ` · ${team1.size}/2` : ''}
              </Txt>
              <Pills
                options={active.filter((p) => !inTeam2(p.id)).map((p) => ({ key: p.id, label: p.name }))}
                selected={team1}
                onToggle={toggleTeam(1)}
              />
            </View>
            <View style={styles.team}>
              <Txt variant="label" tone="muted">
                Pareja 2{team2.size ? ` · ${team2.size}/2` : ''}
              </Txt>
              <Pills
                options={active.filter((p) => !inTeam1(p.id)).map((p) => ({ key: p.id, label: p.name }))}
                selected={team2}
                onToggle={toggleTeam(2)}
              />
            </View>
          </>
        ) : (
          <Field label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" />
        )}

        <Button
          title={id ? 'Guardar' : 'Empezar la partida'}
          kind="primary"
          onPress={save}
          disabled={busy || !canSave || (!!id && !existing)}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  team: { gap: space.sm },
})
