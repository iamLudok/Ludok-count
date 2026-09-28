import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Label } from '../../src/ui/Card'
import { Field } from '../../src/ui/Field'
import { Pills } from '../../src/ui/Pills'
import { useToast } from '../../src/ui/Toast'
import { space } from '../../src/ui/theme'
import { usePeople, useSushi, useDrinks, useExpenses } from '../../src/hooks/useData'
import { useSettings } from '../../src/hooks/useSettings'
import { addPerson } from '../../src/lib/people'
import { updateSettings } from '../../src/lib/settings'
import { sushiStatsByPerson } from '../../src/lib/sushi'
import { drinkStatsByPerson } from '../../src/lib/drinks'
import { balances } from '../../src/lib/expenses'
import { formatMoney } from '../../src/lib/money'

export default function CrewScreen() {
  const { data: people, ready } = usePeople()
  const { data: sushi } = useSushi()
  const { data: drinks } = useDrinks()
  const { data: money } = useExpenses()
  const settings = useSettings()
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const sushiStats = useMemo(() => sushiStatsByPerson(sushi.entries), [sushi.entries])
  const drinkStats = useMemo(() => drinkStatsByPerson(drinks.entries, drinks.counts), [drinks])
  // Saldo total contando solo los grupos sin archivar: un grupo archivado se
  // da por cerrado, y arrastrar su saldo aquí confundiría.
  const balance = useMemo(() => {
    const open = new Set(money.groups.filter((g) => !g.archivedAt).map((g) => g.id))
    const exp = money.expenses.filter((e) => open.has(e.groupId))
    const ids = new Set(exp.map((e) => e.id))
    return balances(exp, money.shares.filter((s) => ids.has(s.expenseId)))
  }, [money])

  const add = async () => {
    setError(null)
    try {
      const p = await addPerson(name)
      setName('')
      toast(`${p.name} ya está en la cuadrilla`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo añadir')
    }
  }

  const active = people.filter((p) => !p.archivedAt)
  const archived = people.filter((p) => p.archivedAt)

  const card = (id: string, personName: string, faded = false) => {
    const s = sushiStats.get(id)
    const d = drinkStats.get(id)
    const b = balance.get(id) ?? 0
    const bits = [
      s ? `sushi: media ${Math.round(s.average)}` : null,
      d ? `${d.total} ${d.total === 1 ? 'bebida' : 'bebidas'}` : null,
    ].filter(Boolean)
    return (
      <Card key={id} onPress={() => router.push(`/person/${id}`)} style={styles.item}>
        <View style={styles.row}>
          <Txt variant="section" tone={faded ? 'muted' : 'fg'} style={{ flex: 1 }} numberOfLines={1}>
            {personName}
            {id === settings.mePersonId ? ' · Tú' : ''}
          </Txt>
          {b !== 0 ? (
            <Txt variant="amount" tone={b > 0 ? 'credit' : 'debt'}>
              {formatMoney(b, { sign: true })}
            </Txt>
          ) : null}
        </View>
        {bits.length ? (
          <Txt variant="small" tone="muted">
            {bits.join(' · ')}
          </Txt>
        ) : null}
      </Card>
    )
  }

  return (
    <Screen title="Cuadrilla" padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.add}>
          <View style={{ flex: 1 }}>
            <Field
              value={name}
              onChangeText={(t) => {
                setName(t)
                setError(null)
              }}
              placeholder="Nombre"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={add}
            />
          </View>
          <Button title="Añadir" kind="primary" onPress={add} disabled={!name.trim()} />
        </View>
        {error ? (
          <Txt variant="small" tone="danger">
            {error}
          </Txt>
        ) : null}

        {ready && active.length === 0 ? (
          <Txt variant="body" tone="muted">
            Aún no hay nadie. Añade a la gente de la cuadrilla para poder apuntarles sushi, rondas y gastos.
          </Txt>
        ) : null}

        {active.length ? (
          <Card>
            <Txt variant="label" tone="muted">
              ¿Quién eres tú?
            </Txt>
            <Txt variant="small" tone="muted">
              Para ver «mis gastos» en cada grupo. Tócate para marcarte, o vuelve a tocar para quitarlo.
            </Txt>
            <Pills
              single
              options={active.map((p) => ({ key: p.id, label: p.name }))}
              selected={settings.mePersonId}
              onToggle={(pid) => updateSettings({ mePersonId: pid === settings.mePersonId ? undefined : pid })}
            />
          </Card>
        ) : null}

        {active.map((p) => card(p.id, p.name))}
        {active.length ? (
          <Txt variant="small" tone="faint">
            El saldo suma los grupos de gastos abiertos: en verde a quien le deben, en naranja quien debe.
          </Txt>
        ) : null}

        {archived.length ? (
          <>
            <Label>Ya no vienen</Label>
            {showArchived ? (
              archived.map((p) => card(p.id, p.name, true))
            ) : (
              <Button title={`Ver ${archived.length}`} kind="ghost" onPress={() => setShowArchived(true)} />
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  item: { gap: space.xs, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
})
