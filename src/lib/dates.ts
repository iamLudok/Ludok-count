/**
 * Fechas en castellano, a mano. `toLocaleDateString('es-ES')` depende de los
 * locales que traiga Hermes en cada móvil y a veces salía en inglés; para
 * cuatro formatos no merece la pena arriesgarlo.
 */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** «27 sep 2026», sin año si es el actual. */
export function formatDate(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** «hoy», «ayer», «el viernes» (esta semana) o la fecha. */
export function relativeDay(ms: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days > 1 && days < 7) return `el ${WEEKDAYS[new Date(ms).getDay()]}`
  return formatDate(ms, now)
}

/** «viernes, 27 sep 2026», para la cabecera de una sesión. */
export function longDate(ms: number): string {
  const d = new Date(ms)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
