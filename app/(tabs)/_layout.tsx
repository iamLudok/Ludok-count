import { Tabs } from 'expo-router'
import { View, StyleSheet, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius } from '../../src/ui/theme'

/**
 * Las cinco pestañas. Los iconos son formas geométricas hechas con vistas y
 * bordes en vez de emojis: en «Sala oscura» la interfaz es monocroma, y un
 * emoji a color rompería justo eso.
 */
type Shape = 'sushi' | 'drinks' | 'expenses' | 'crew' | 'settings'

function Icon({ shape, color }: { shape: Shape; color: ColorValue }) {
  if (shape === 'sushi') {
    // Un maki visto desde arriba: el alga y el relleno.
    return (
      <View style={styles.box}>
        <View style={[styles.ring, { borderColor: color }]} />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
    )
  }
  if (shape === 'drinks') {
    // Un vaso a medio llenar.
    return (
      <View style={styles.box}>
        <View style={[styles.glass, { borderColor: color }]}>
          <View style={[styles.liquid, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }
  if (shape === 'expenses') {
    // Dos billetes.
    return (
      <View style={styles.box}>
        <View style={[styles.bill, { borderColor: color, top: 3, left: 0 }]} />
        <View style={[styles.bill, { borderColor: color, top: 8, left: 4, backgroundColor: color }]} />
      </View>
    )
  }
  if (shape === 'crew') {
    // Tres cabezas y los hombros.
    return (
      <View style={styles.box}>
        <View style={styles.heads}>
          <View style={[styles.head, { backgroundColor: color }]} />
          <View style={[styles.head, { backgroundColor: color }]} />
          <View style={[styles.head, { backgroundColor: color }]} />
        </View>
        <View style={[styles.shoulders, { backgroundColor: color }]} />
      </View>
    )
  }
  return (
    <View style={styles.box}>
      <View style={[styles.gear, { borderColor: color }]} />
    </View>
  )
}

export default function TabsLayout() {
  const palette = usePalette()
  // La barra de gestos del sistema se come el texto de las pestañas si no se
  // deja hueco por debajo (se ve en un Pixel con navegación por gestos).
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.bg },
        tabBarActiveTintColor: palette.fg,
        tabBarInactiveTintColor: palette.faint,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Sushi', tabBarIcon: ({ color }) => <Icon shape="sushi" color={color} /> }}
      />
      <Tabs.Screen
        name="drinks"
        options={{ title: 'Bebida', tabBarIcon: ({ color }) => <Icon shape="drinks" color={color} /> }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Gastos', tabBarIcon: ({ color }) => <Icon shape="expenses" color={color} /> }}
      />
      <Tabs.Screen
        name="crew"
        options={{ title: 'Cuadrilla', tabBarIcon: ({ color }) => <Icon shape="crew" color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Icon shape="settings" color={color} /> }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  box: { width: 22, height: 20, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 3 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: radius.pill },
  glass: {
    width: 13,
    height: 18,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    justifyContent: 'flex-end',
    padding: 1.5,
  },
  liquid: { height: 7, borderRadius: 1 },
  bill: { position: 'absolute', width: 16, height: 10, borderWidth: 2, borderRadius: 2 },
  heads: { flexDirection: 'row', gap: 1.5 },
  head: { width: 6, height: 6, borderRadius: radius.pill },
  shoulders: { width: 21, height: 6, marginTop: 2, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  gear: { width: 17, height: 17, borderRadius: radius.pill, borderWidth: 3, borderStyle: 'dashed' },
})
