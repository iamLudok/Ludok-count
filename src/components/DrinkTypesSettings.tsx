import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useDrinkTypes } from '../hooks/useData'
import { addDrinkType, renameDrinkType, setDrinkTypeArchived, moveDrinkType } from '../lib/drinks'
import { Card } from '../ui/Card'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { Prompt } from '../ui/Prompt'
import { StepButton } from '../ui/Stepper'
import { space } from '../ui/theme'
import type { DrinkType } from '../types'

/**
 * La lista de bebidas que salen en cada sesión. Quitar un tipo lo archiva en
 * vez de borrarlo: lo ya bebido sigue contando, y si se vuelve a crear con el
 * mismo nombre, recupera su historial.
 */
export function DrinkTypesSettings() {
  const { data: types } = useDrinkTypes()
  const [renaming, setRenaming] = useState<DrinkType | null>(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const active = types.filter((t) => !t.archivedAt)
  const archived = types.filter((t) => t.archivedAt)

  return (
    <Card>
      <Txt variant="title">Tipos de bebida</Txt>
      <Txt variant="small" tone="muted">
        Salen en este orden en cada sesión. Toca un nombre para cambiarlo.
      </Txt>
      {active.map((t, i) => (
        <View key={t.id} style={styles.row}>
          <Pressable onPress={() => setRenaming(t)} style={{ flex: 1 }} accessibilityRole="button" hitSlop={6}>
            <Txt variant="body">{t.name}</Txt>
          </Pressable>
          <StepButton label="↑" size="sm" onPress={() => moveDrinkType(t.id, -1)} disabled={i === 0} />
          <StepButton label="↓" size="sm" onPress={() => moveDrinkType(t.id, 1)} disabled={i === active.length - 1} />
          <Button title="Quitar" kind="ghost" small onPress={() => setDrinkTypeArchived(t.id, true)} />
        </View>
      ))}
      <Button title="Añadir tipo" onPress={() => setAdding(true)} />

      {archived.length ? (
        showArchived ? (
          archived.map((t) => (
            <View key={t.id} style={styles.row}>
              <Txt variant="body" tone="faint" style={{ flex: 1 }}>
                {t.name}
              </Txt>
              <Button title="Recuperar" kind="ghost" small onPress={() => setDrinkTypeArchived(t.id, false)} />
            </View>
          ))
        ) : (
          <Button title={`Ver ${archived.length} quitados`} kind="ghost" small onPress={() => setShowArchived(true)} />
        )
      ) : null}

      <Prompt
        visible={adding}
        title="Nuevo tipo de bebida"
        placeholder="Sidra, patxaran…"
        confirm="Añadir"
        onCancel={() => setAdding(false)}
        onSubmit={async (text) => {
          await addDrinkType(text)
          setAdding(false)
        }}
      />
      <Prompt
        visible={renaming !== null}
        title="Cambiar nombre"
        initial={renaming?.name ?? ''}
        onCancel={() => setRenaming(null)}
        onSubmit={async (text) => {
          await renameDrinkType(renaming!.id, text)
          setRenaming(null)
        }}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
