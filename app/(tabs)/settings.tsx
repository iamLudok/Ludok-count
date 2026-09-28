import { useState } from 'react'
import { ScrollView, View, StyleSheet, Alert } from 'react-native'
import { Screen } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { Button } from '../../src/ui/Button'
import { Card, Row } from '../../src/ui/Card'
import { Chips } from '../../src/ui/Chips'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius, space } from '../../src/ui/theme'
import { useSettings } from '../../src/hooks/useSettings'
import { usePeople, useSushi, useDrinks, useExpenses, useMus } from '../../src/hooks/useData'
import { updateSettings } from '../../src/lib/settings'
import { shareBackup, pickJsonFile, importBackup, daysSinceBackup } from '../../src/lib/backup'
import { NextcloudSettings } from '../../src/components/NextcloudSettings'
import { DrinkTypesSettings } from '../../src/components/DrinkTypesSettings'

const THEMES = [
  { key: 'system' as const, label: 'Sistema' },
  { key: 'dark' as const, label: 'Oscuro' },
  { key: 'light' as const, label: 'Claro' },
]

export default function SettingsScreen() {
  const settings = useSettings()
  const palette = usePalette()
  const { data: people } = usePeople()
  const { data: sushi } = useSushi()
  const { data: drinks } = useDrinks()
  const { data: money } = useExpenses()
  const { data: mus } = useMus()
  const [busy, setBusy] = useState(false)

  const days = daysSinceBackup(settings.lastBackup)
  const lastBackupText = !settings.lastBackup
    ? 'nunca'
    : days === 0
      ? 'hoy'
      : `hace ${days} ${days === 1 ? 'día' : 'días'}`

  const doExport = async () => {
    setBusy(true)
    try {
      await shareBackup()
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    setBusy(true)
    try {
      const raw = await pickJsonFile()
      if (!raw) return
      // Se pregunta DESPUÉS de elegir el fichero, para que la decisión de
      // reemplazar o fusionar se tome sabiendo ya qué copia es.
      Alert.alert('Importar copia', '¿Reemplazar todo lo que hay ahora, o fusionar añadiendo sin borrar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Fusionar', onPress: () => runImport(raw, 'merge') },
        { text: 'Reemplazar', style: 'destructive', onPress: () => runImport(raw, 'replace') },
      ])
    } catch (e) {
      Alert.alert('No se pudo leer', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  const runImport = async (raw: string, mode: 'replace' | 'merge') => {
    setBusy(true)
    try {
      const res = await importBackup(raw, mode)
      Alert.alert(
        'Importado',
        `${res.people} personas, ${res.sushiSessions} sesiones de sushi, ${res.drinkSessions} de bebida, ${res.expenses} gastos y ${res.musMatches} partidas de mus.`,
      )
    } catch (e) {
      Alert.alert('Error al importar', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Ajustes" padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Copias — lo más importante de la app */}
        <Card>
          <Txt variant="title">Copia de seguridad</Txt>
          <Txt variant="small" tone="muted">
            Los datos viven solo en este móvil. Exporta a menudo y guarda el fichero donde quieras.
          </Txt>
          <View style={[styles.stat, { borderColor: palette.line }]}>
            <Row label="Personas" value={String(people.length)} />
            <Row label="Sesiones de sushi" value={String(sushi.sessions.length)} />
            <Row label="Sesiones de bebida" value={String(drinks.sessions.length)} />
            <Row label="Gastos y pagos" value={String(money.expenses.length)} />
            <Row label="Partidas de mus" value={String(mus.length)} />
            <Row label="Última copia" value={lastBackupText} />
          </View>
          <Button title="Exportar copia" kind="primary" onPress={doExport} disabled={busy} />
          <Button title="Importar copia" onPress={doImport} disabled={busy} />
        </Card>

        <NextcloudSettings />

        <DrinkTypesSettings />

        <Card>
          <Txt variant="title">Tema</Txt>
          <Chips options={THEMES} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
        </Card>

        <Txt variant="small" tone="faint" style={{ textAlign: 'center' }}>
          Ludok Count · vuestros datos, vuestros.
        </Txt>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  stat: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.xs },
})
