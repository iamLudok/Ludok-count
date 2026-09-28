import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Screen, Empty } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Field } from '../../src/ui/Field'
import { Pills } from '../../src/ui/Pills'
import { Chips } from '../../src/ui/Chips'
import { DateField } from '../../src/ui/DateField'
import { InlineStepper } from '../../src/ui/Stepper'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius, space, type } from '../../src/ui/theme'
import { useGroup, usePeopleById } from '../../src/hooks/useData'
import { addExpense, updateExpense, deleteExpense, buildShares, type SplitPart } from '../../src/lib/expenses'
import { parseMoney, formatMoney, moneyToInput } from '../../src/lib/money'
import { byName } from '../../src/lib/people'
import type { SplitMode } from '../../src/types'

const MODES = [
  { key: 'equal' as const, label: 'A partes iguales' },
  { key: 'shares' as const, label: 'Por partes' },
  { key: 'amounts' as const, label: 'Importes exactos' },
]

/**
 * Añadir o editar un gasto (`?groupId=` y, al editar, `&id=`). Las tres
 * formas de repartir guardan su propio estado por separado, para que cambiar
 * de modo para mirar y volver no borre lo que ya se había escrito.
 */
export default function ExpenseForm() {
  const { groupId, id } = useLocalSearchParams<{ groupId: string; id?: string }>()
  const { data, ready } = useGroup(groupId)
  const people = usePeopleById()
  const palette = usePalette()

  const [title, setTitle] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidBy, setPaidBy] = useState<string | undefined>()
  const [date, setDate] = useState(Date.now())
  const [mode, setMode] = useState<SplitMode>('equal')
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [parts, setParts] = useState<Map<string, number>>(new Map())
  const [exact, setExact] = useState<Map<string, string>>(new Map())
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const existing = id ? data.expenses.find((e) => e.id === id) : undefined

  // Quien puede entrar en el reparto: los miembros, más cualquiera que ya
  // estuviera en este gasto aunque luego saliera del grupo.
  const candidates = useMemo(() => {
    const ids = new Set(data.memberIds)
    if (existing) {
      ids.add(existing.paidBy)
      for (const s of data.shares) if (s.expenseId === existing.id) ids.add(s.personId)
    }
    return [...ids].map((pid) => ({ id: pid, name: people.get(pid)?.name ?? '¿?' })).sort(byName)
  }, [data.memberIds, data.shares, existing, people])

  // Se carga UNA vez, igual que el formulario de grupo: lo que se está
  // escribiendo no se puede pisar porque la consulta se refresque.
  useEffect(() => {
    if (loaded || !ready || !data.group) return
    if (id && existing) {
      const mine = data.shares.filter((s) => s.expenseId === existing.id)
      setTitle(existing.title)
      setAmountText(moneyToInput(existing.amount))
      setPaidBy(existing.paidBy)
      setDate(existing.date)
      setMode(existing.splitMode)
      setIncluded(new Set(mine.map((s) => s.personId)))
      setParts(new Map(mine.map((s) => [s.personId, existing.splitMode === 'shares' ? s.weight : 1])))
      setExact(new Map(mine.map((s) => [s.personId, moneyToInput(s.amount)])))
      setLoaded(true)
    } else if (!id) {
      setIncluded(new Set(data.memberIds))
      setParts(new Map(data.memberIds.map((pid) => [pid, 1])))
      setLoaded(true)
    }
  }, [loaded, ready, id, existing, data])

  const amount = parseMoney(amountText)

  const splitParts: SplitPart[] = candidates.map((c) => ({
    personId: c.id,
    value:
      mode === 'equal'
        ? included.has(c.id) ? 1 : 0
        : mode === 'shares'
          ? parts.get(c.id) ?? 0
          : parseMoney(exact.get(c.id) ?? '') ?? 0,
  }))

  // Vista previa en vivo: lo que le toca a cada uno, o el motivo por el que
  // todavía no se puede guardar. Es la MISMA función que valida al guardar,
  // así que lo que se ve aquí es exactamente lo que se va a apuntar.
  const preview = ((): { shares?: Map<string, number>; error?: string } => {
    if (amount === null) return { error: amountText.trim() ? 'Importe no válido.' : 'Pon el importe.' }
    try {
      return { shares: new Map(buildShares(amount, mode, splitParts).map((s) => [s.personId, s.amount])) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Reparto no válido.' }
    }
  })()

  if (!ready) return <Screen back title="">{null}</Screen>
  if (!data.group || (id && !existing)) {
    return (
      <Screen back title="Gasto">
        <Empty text="Este gasto ya no existe." />
      </Screen>
    )
  }

  const toggleIncluded = (pid: string) => {
    const next = new Set(included)
    if (next.has(pid)) next.delete(pid)
    else next.add(pid)
    setIncluded(next)
  }

  const save = async () => {
    if (!paidBy) return Alert.alert('Falta quién pagó', 'Elige quién ha puesto el dinero.')
    if (amount === null || preview.error) return Alert.alert('No se puede guardar', preview.error ?? 'Revisa el importe.')
    setBusy(true)
    try {
      const input = { title, amount, paidBy, date, splitMode: mode, parts: splitParts }
      if (id) await updateExpense(id, input)
      else await addExpense({ ...input, groupId })
      router.back()
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  const destroy = () =>
    Alert.alert('¿Borrar el gasto?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(id!)
          router.back()
        },
      },
    ])

  const assigned =
    mode === 'amounts' ? splitParts.reduce((s, p) => s + (Number.isFinite(p.value) ? p.value : 0), 0) : null

  return (
    <Screen title={id ? 'Editar gasto' : 'Nuevo gasto'} subtitle={data.group.name} back padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Qué" value={title} onChangeText={setTitle} placeholder="Cena, gasolina, entradas…" />
        <Field
          label="Cuánto"
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0,00 €"
          keyboardType="decimal-pad"
          style={type.title}
        />
        <Txt variant="label" tone="muted">
          Pagó
        </Txt>
        <Pills
          options={candidates.map((c) => ({ key: c.id, label: c.name }))}
          selected={paidBy}
          onToggle={setPaidBy}
          single
        />
        <DateField label="Cuándo" value={date} onChange={setDate} />

        <Txt variant="label" tone="muted">
          Entre quién
        </Txt>
        <Chips options={MODES} value={mode} onChange={setMode} />

        <View style={[styles.split, { borderColor: palette.line }]}>
          {mode === 'equal' ? (
            <Pills
              options={candidates.map((c) => ({ key: c.id, label: c.name }))}
              selected={included}
              onToggle={toggleIncluded}
            />
          ) : null}
          {candidates.map((c) => {
            const share = preview.shares?.get(c.id)
            if (mode === 'equal') {
              return share !== undefined ? (
                <View key={c.id} style={styles.line}>
                  <Txt variant="small" tone="muted" style={{ flex: 1 }}>
                    {c.name}
                  </Txt>
                  <Txt variant="data">{formatMoney(share)}</Txt>
                </View>
              ) : null
            }
            return (
              <View key={c.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{c.name}</Txt>
                  {mode === 'shares' && share !== undefined ? (
                    <Txt variant="data" tone="faint">
                      {formatMoney(share)}
                    </Txt>
                  ) : null}
                </View>
                {mode === 'shares' ? (
                  <InlineStepper
                    value={parts.get(c.id) ?? 0}
                    onChange={(d) => setParts(new Map(parts).set(c.id, Math.max(0, (parts.get(c.id) ?? 0) + d)))}
                  />
                ) : (
                  <TextInput
                    value={exact.get(c.id) ?? ''}
                    onChangeText={(t) => setExact(new Map(exact).set(c.id, t))}
                    placeholder="0,00"
                    placeholderTextColor={palette.faint}
                    keyboardType="decimal-pad"
                    style={[
                      styles.money,
                      type.amount,
                      { borderColor: palette.line, color: palette.fg, backgroundColor: palette.bg },
                    ]}
                  />
                )}
              </View>
            )
          })}
          {mode === 'amounts' && amount !== null ? (
            <Txt variant="data" tone={assigned === amount ? 'muted' : 'warn'}>
              Repartido {formatMoney(assigned ?? 0)} de {formatMoney(amount)}
            </Txt>
          ) : null}
        </View>

        {preview.error ? (
          <Txt variant="small" tone="warn">
            {preview.error}
          </Txt>
        ) : null}

        <Button title={id ? 'Guardar' : 'Añadir gasto'} kind="primary" onPress={save} disabled={busy} />
        {id ? <Button title="Borrar gasto" kind="danger" onPress={destroy} disabled={busy} /> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  split: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  money: {
    width: 110,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    textAlign: 'right',
  },
})
