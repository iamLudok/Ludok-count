import { View, StyleSheet, Pressable, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { space } from './theme'

/**
 * Contenedor de pantalla. Respeta la zona segura de arriba (barra de estado) y
 * deja el borde inferior a la barra de pestañas, que ya la gestiona el layout.
 */
export function Screen({
  children,
  title,
  subtitle,
  right,
  back,
  padded = true,
  style,
}: {
  children: React.ReactNode
  title?: string
  /** Línea pequeña bajo el título (la fecha de una sesión, por ejemplo). */
  subtitle?: string
  right?: React.ReactNode
  /** Fichas: flecha de volver a la izquierda del título. */
  back?: boolean
  padded?: boolean
  style?: ViewStyle
}) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }, style]}>
      {title !== undefined && (
        <View style={styles.head}>
          {back ? <BackButton /> : null}
          <View style={styles.headTitle}>
            <Txt variant={back ? 'title' : 'display'} numberOfLines={1}>
              {title}
            </Txt>
            {subtitle ? (
              <Txt variant="small" tone="muted" numberOfLines={1}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
          {right}
        </View>
      )}
      <View style={[styles.body, padded && styles.padded]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  headTitle: { flex: 1 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -space.sm },
  chevron: { width: 12, height: 12, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: '45deg' }], marginLeft: 4 },
  body: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
})

/**
 * Volver, dibujado con dos bordes: sin librería de iconos, como las pestañas.
 * Si no hay a dónde volver (se entró por un enlace), va al inicio.
 */
function BackButton() {
  const palette = usePalette()
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={8}
      style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
    >
      <View style={[styles.chevron, { borderColor: palette.fg }]} />
    </Pressable>
  )
}

/** Estado vacío: un texto y, si hace falta, una acción. */
export function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <View style={styles2.empty}>
      <Txt variant="body" tone="muted" style={{ textAlign: 'center' }}>
        {text}
      </Txt>
      {children}
    </View>
  )
}

const styles2 = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
})
