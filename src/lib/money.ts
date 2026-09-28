/**
 * Dinero: todo en CÉNTIMOS enteros. Con decimales de coma flotante, 0,1 + 0,2
 * no da 0,3 y los balances acababan en «debes 0,0000001 €». Aquí solo se
 * convierte a euros al pintar y al leer lo que escribe el usuario.
 *
 * Sin `Intl` a propósito: Hermes no trae todos los locales en Android, y
 * `toLocaleString('es-ES')` podía salir con formato inglés según el móvil.
 */

/**
 * Lee lo que escribe el usuario: «12», «12,5», «12.50», «1.234,56», «8 €».
 * Devuelve céntimos, o `null` si no es un importe válido (vacío, negativo,
 * letras, más de dos decimales).
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[\s€]/g, '')
  if (!s) return null
  // Si vienen punto y coma, el ÚLTIMO es el decimal y el otro son miles.
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.'
    const thousands = dec === ',' ? '.' : ','
    s = s.split(thousands).join('').replace(dec, '.')
  } else if (lastComma >= 0) {
    s = s.replace(',', '.')
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // «1.500» con solo puntos y grupos de tres: en castellano son miles, no 1,5.
    s = s.split('.').join('')
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
}

/** 123456 → «1.234,56 €». Con `sign`, los positivos llevan «+». */
export function formatMoney(cents: number, opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, symbol = true } = opts
  const neg = cents < 0
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const prefix = neg ? '−' : sign && cents > 0 ? '+' : ''
  return `${prefix}${grouped},${frac}${symbol ? ' €' : ''}`
}

/** Céntimos a texto editable, sin símbolo ni miles: 1250 → «12,50». */
export function moneyToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Reparte `total` céntimos según unos pesos, sin perder ni inventar ni un
 * céntimo: primero la parte entera de cada uno y después los céntimos que
 * sobran, a quien más «decimal» se quedó sin cobrar (a igualdad, al primero de
 * la lista). 10 € entre 3 = 3,34 + 3,33 + 3,33, y la suma es siempre el total.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0)
  if (sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const out = exact.map(Math.floor)
  // Siempre sobran menos céntimos que personas con peso, así que nadie
  // recibe más de uno de propina.
  const left = total - out.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .filter(({ i }) => weights[i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < left; k++) out[order[k % order.length].i]++
  return out
}
