// Tiene que ir ANTES que cualquier otra cosa: Hermes no trae `URL` ni
// `URLSearchParams` completos, y expo-router y la subida a Nextcloud los usan.
// Sin esto, fallan con "URLSearchParams.get is not implemented".
import 'react-native-url-polyfill/auto'
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, AppState } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// Importar `db` crea el esquema de forma síncrona: para cuando esto se
// evalúa, las tablas ya existen y cualquier pantalla puede consultar.
import '../src/lib/db'
import { ensureSettings } from '../src/lib/settings'
import { maybeAutoBackup } from '../src/lib/autoBackup'
import { useSettingsQuery } from '../src/hooks/useSettings'
import { Welcome } from '../src/components/Welcome'
import { ThemeProvider, usePalette, useIsDark } from '../src/ui/ThemeProvider'
import { ToastProvider } from '../src/ui/Toast'
import { Txt } from '../src/ui/Text'
import { space } from '../src/ui/theme'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Las tablas ya están creadas (al importar `db`). Aquí solo se persisten
    // los ajustes por defecto y los tipos de bebida la primera vez.
    ensureSettings()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al abrir la base de datos'))
  }, [])

  // Copia automática al Nextcloud propio: al arrancar y cada vez que se entra
  // o se sale de la app. `maybeAutoBackup` decide sola si toca (WiFi, tiempo
  // desde la última), así que llamarla de más no cuesta nada. Los fallos se
  // ignoran a propósito: si no hay red o el servidor no está, no es momento de
  // dar la tabarra — el estado se ve en Ajustes y en el aviso de copia.
  useEffect(() => {
    if (!ready) return
    const run = () => {
      maybeAutoBackup().catch(() => {})
    }
    run()
    // Al salir también: esta app se usa en ráfagas (una noche de buffet) y
    // luego pasa días cerrada; si solo subiera al abrir, lo de esa noche no
    // llegaría al servidor hasta la próxima vez.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') run()
    })
    return () => sub.remove()
  }, [ready])

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <Shell ready={ready} error={error} />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function Shell({ ready, error }: { ready: boolean; error: string | null }) {
  const palette = usePalette()
  const isDark = useIsDark()
  const { data: settings, ready: settingsReady } = useSettingsQuery()
  const bar = <StatusBar style={isDark ? 'light' : 'dark'} />

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        {bar}
        <Txt variant="body" tone="danger" style={{ textAlign: 'center' }}>
          {error}
        </Txt>
      </View>
    )
  }

  if (!ready || !settingsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        {bar}
        <ActivityIndicator color={palette.muted} />
      </View>
    )
  }

  // Solo en instalaciones nuevas (y hasta que se restaure una copia o se pase).
  if (settings.onboardedAt === undefined) {
    return (
      <>
        {bar}
        {/* No hace falta avisar de que ha terminado: al guardar `onboardedAt`
            la consulta reactiva de ajustes vuelve a pintar esto y ya entra. */}
        <Welcome />
      </>
    )
  }

  return (
    <>
      {bar}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}
