import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../src/ui/Screen'
import { Button } from '../../src/ui/Button'
import { Field } from '../../src/ui/Field'
import { Txt } from '../../src/ui/Text'
import { Pills } from '../../src/ui/Pills'
import { space } from '../../src/ui/theme'
import { useGroup, usePeople } from '../../src/hooks/useData'
import { createGroup, renameGroup, setGroupMembers } from '../../src/lib/expenses'

/** Nuevo grupo de gastos, o cambiar nombre y miembros de uno (`?id=`). */
export default function GroupForm() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { data: existing, ready } = useGroup(id)
  const { data: people } = usePeople()
  const [name, setName] = useState('')
  const [who, setWho] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(!id)
  const [busy, setBusy] = useState(false)

  // Se carga UNA vez: si se recargara con cada cambio de la consulta, lo que
  // el usuario está tocando se le deshacería debajo.
  useEffect(() => {
    if (!id || loaded || !ready || !existing.group) return
    setName(existing.group.name)
    setWho(new Set(existing.memberIds))
    setLoaded(true)
  }, [id, loaded, ready, existing])

  // Miembros actuales aunque estén archivados: si no, desaparecerían de la
  // lista y al guardar se intentaría sacarlos del grupo sin querer.
  const options = people.filter((p) => !p.archivedAt || who.has(p.id))

  const toggle = (pid: string) => {
    const next = new Set(who)
    if (next.has(pid)) next.delete(pid)
    else next.add(pid)
    setWho(next)
  }

  const save = async () => {
    setBusy(true)
    try {
      if (id) {
        await renameGroup(id, name)
        const { kept } = await setGroupMembers(id, [...who])
        if (kept.length) {
          const names = kept.map((k) => people.find((p) => p.id === k)?.name ?? '¿?').join(', ')
          Alert.alert(
            'Algunos se quedan',
            `${names} ya aparece en gastos de este grupo. Para sacarle, borra o cambia antes esos gastos.`,
          )
        }
        router.back()
      } else {
        const newId = await createGroup(name, [...who])
        router.replace(`/group/${newId}`)
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={id ? 'Editar grupo' : 'Nuevo grupo'} back padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Viaje a Asturias, cena de Navidad…" />
        <Txt variant="label" tone="muted">
          Quién está{who.size ? ` · ${who.size}` : ''}
        </Txt>
        <Pills options={options.map((p) => ({ key: p.id, label: p.name }))} selected={who} onToggle={toggle} />
        <Txt variant="small" tone="faint">
          Los gastos se reparten por defecto entre todos los del grupo; en cada gasto se puede quitar a
          quien no entre.
        </Txt>
        <Button
          title={id ? 'Guardar' : 'Crear grupo'}
          kind="primary"
          onPress={save}
          disabled={busy || !loaded || !name.trim() || who.size < 2}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
})
