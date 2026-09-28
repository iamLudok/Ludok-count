/**
 * Clasificación con empates: dos con 30 trozos son los dos primeros, y el
 * siguiente es tercero (1, 1, 3), como en cualquier podio. Numerar 1, 2, 3 a
 * secas le daba el oro a quien saliera antes en la lista, y eso en una
 * cuadrilla genera discusiones de verdad.
 *
 * Los que tienen 0 no reciben puesto: haber ido y no comer nada no es quedar
 * último, es no participar.
 */
export function rank<T>(items: T[], value: (t: T) => number): { item: T; value: number; position?: number }[] {
  const sorted = [...items].map((item) => ({ item, value: value(item) })).sort((a, b) => b.value - a.value)
  let position = 0
  let prev = Number.NaN
  return sorted.map((row, i) => {
    if (row.value !== prev) {
      position = i + 1
      prev = row.value
    }
    return { ...row, position: row.value > 0 ? position : undefined }
  })
}
