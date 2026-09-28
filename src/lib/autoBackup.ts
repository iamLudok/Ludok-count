import * as Network from 'expo-network'
import { exportAll } from './backup'
import { getSettings, updateSettings } from './settings'
import { configFrom, uploadFile } from './nextcloud'
import { isDue, backupFilename } from './backupPolicy'

export { STALE_DAYS, autoBackupIsStale } from './backupPolicy'

/**
 * Copia automática al Nextcloud propio.
 *
 * Se dispara al abrir la app (y al volver a ella), no con una tarea en segundo
 * plano: Android mata esas tareas de forma agresiva y encima serían invisibles.
 * Se sube también al mandar la app al fondo, que en esta app importa más: se
 * usa en ráfagas (una noche de buffet, un viaje) y luego pasa días cerrada, así
 * que lo apuntado esa noche sube en cuanto se cierra con WiFi.
 *
 * Solo por WiFi, que es lo que se pidió: en datos móviles ni se intenta.
 */


export type AutoBackupResult =
  | { status: 'ok'; filename: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

/** Sube la copia ahora mismo, sin mirar WiFi ni cuánto hace de la última. */
export async function backupNow(): Promise<AutoBackupResult> {
  const settings = await getSettings()
  const config = configFrom(settings)
  if (!config) return { status: 'skipped', reason: 'Falta configurar el servidor.' }

  try {
    const data = await exportAll()
    const filename = backupFilename()
    await uploadFile(config, filename, JSON.stringify(data, null, 2))
    const now = Date.now()
    // `lastBackup` también, para que el aviso de «llevas X días sin copia» se
    // entere: una copia subida a tu servidor cuenta como copia.
    await updateSettings({ lastAutoBackupAt: now, lastBackup: now })
    return { status: 'ok', filename }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

/**
 * La llama la app al arrancar y al volver del segundo plano. Comprueba ella
 * misma si toca, así que se puede invocar sin miedo tantas veces como haga falta.
 */
export async function maybeAutoBackup(): Promise<AutoBackupResult> {
  const settings = await getSettings()
  if (!settings.autoBackup) return { status: 'skipped', reason: 'Desactivada.' }
  if (!configFrom(settings)) return { status: 'skipped', reason: 'Falta configurar el servidor.' }

  if (!isDue(settings.lastAutoBackupAt)) {
    return { status: 'skipped', reason: 'Ya se hizo hace poco.' }
  }

  const net = await Network.getNetworkStateAsync()
  if (net.type !== Network.NetworkStateType.WIFI) {
    return { status: 'skipped', reason: 'No estás en WiFi.' }
  }
  if (net.isInternetReachable === false) {
    return { status: 'skipped', reason: 'La red no llega a ningún sitio.' }
  }

  return backupNow()
}

