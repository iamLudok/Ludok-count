import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { usePeople } from '../hooks/useData'
import { Pills } from '../ui/Pills'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { space } from '../ui/theme'

/**
 * Quién ha venido. Solo sale la gente activa: los archivados no van a
 * aparecer por el buffet, y si vuelven se recuperan desde Cuadrilla.
 */
export function AttendeePicker({
  selected,
  onChange,
  label = 'Quién ha venido',
  exclude,
}: {
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  label?: string
  /** Gente que no se ofrece (los que ya están en la sesión). */
  exclude?: ReadonlySet<string>
}) {
  const { data: people, ready } = usePeople()
  const active = people.filter((p) => !p.archivedAt && !exclude?.has(p.id))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  const allOn = active.length > 0 && active.every((p) => selected.has(p.id))

  if (!ready) return null
  if (!people.some((p) => !p.archivedAt)) {
    return (
      <View style={styles.wrap}>
        <Txt variant="small" tone="muted">
          Aún no hay nadie en la cuadrilla.
        </Txt>
        <Button title="Añadir gente" small onPress={() => router.push('/crew')} />
      </View>
    )
  }
  if (!active.length) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Txt variant="label" tone="muted">
          {label}
          {selected.size ? ` · ${selected.size}` : ''}
        </Txt>
        {exclude ? null : (
          <Button
            title={allOn ? 'Ninguno' : 'Todos'}
            kind="ghost"
            small
            onPress={() => onChange(allOn ? new Set() : new Set(active.map((p) => p.id)))}
          />
        )}
      </View>
      <Pills options={active.map((p) => ({ key: p.id, label: p.name }))} selected={selected} onToggle={toggle} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
