# Ludok Count

App Android para la cuadrilla: **cuántos trozos de sushi se come cada uno en el buffet, quién bebe
más en cada ronda y quién le debe cuánto a quién**, al estilo Tricount.

La lleva una sola persona en su móvil y apunta por todos. Sin cuentas, sin servidores, sin que nadie
tenga que instalarse nada.

React Native con Expo SDK 57.

## Lo que manda: no perder datos nunca

Todo lo demás va después.

- Los datos viven en `/data/data/com.ludok.count/`. No hay cuentas ni servidores.
- Copia de seguridad en JSON, exportable e importable en cualquier momento.
- **Copia automática a un Nextcloud propio** al abrir y al cerrar la app estando en WiFi, un fichero
  por día.
- Aviso en cada pestaña cuando lleva mucho sin copia.
- La capa de datos **se prueba de verdad**, no solo con tipos (ver más abajo).

## Qué se registra

| Apartado | Qué | Detalle |
|---|---|---|
| Cuadrilla | La gente | Se añade, se renombra y se archiva. Quien deja de venir no se borra: su historial sigue contando |
| Sushi | Sesiones de buffet | Cada día, quién fue y cuántos trozos se comió cada uno. Clasificación por media, total y mejor día; récord absoluto |
| Bebida | Sesiones de bebida | Contador por persona **y por tipo** (chupito, cerveza, cubata…, editables). Botón de «ronda para todos» |
| Gastos | Grupos de gastos | Quién paga qué y entre quién se reparte: a partes iguales, por partes o por importes exactos. Saldos y pagos mínimos para quedar en paz |
| Mus | Partidas por parejas | Marcador en vivo a dos bandas (2 contra 2), con «+1» por pareja y meta de piedras configurable (40 por defecto). Se cierra sola al llegar a la meta; historial y clasificación por partidas ganadas |

### No todos van el mismo día

Cada sesión tiene sus asistentes. Que alguien **esté** en una sesión es lo que dice que fue; por eso
«fue y comió 0» no es lo mismo que «no fue», y no ir **no baja la media**. La clasificación de sushi
va por media por defecto justamente por esto: el total premia a quien más veces va, no a quien más
come.

### El mus, por parejas fijas

Cada partida enfrenta a dos parejas de siempre (2 contra 2): se eligen las cuatro personas al crearla
y no se pueden cambiar después. Sumar piedras con «+1» es lo único que hace falta durante la partida;
para corregir un toque de más se toca el número y se escribe el que tocaba.

La partida se cierra **sola** en cuanto una pareja llega a la meta (40 piedras por defecto, ajustable
por partida), y a partir de ahí no admite más puntos: hay que **reabrirla** para seguir. Si al reabrir
la pareja que iba ganando se queda con la puntuación tal cual, el primer punto que caiga —al bando que
sea— la volvería a cerrar en el acto; hay que corregir su marcador hacia abajo antes de seguir sumando.

### Los gastos, al céntimo

- Todo el dinero se guarda en **céntimos enteros**, y la suma de los repartos es **siempre** el
  importe exacto. Cuando no cae justo (110 € entre 6, por ejemplo), el céntimo de más se lo queda
  quien pagó: el resto nunca debe de menos, pero tampoco paga más que los demás por culpa del
  redondeo.
- El saldo de cada uno es lo que ha pagado menos lo que le tocaba. La suma de todos los saldos es 0.
- **Cómo quedar en paz**: la app calcula los pagos a partir del saldo **neto** de cada uno, así que
  si A le debe a B y B le debe a C, sale directamente «A le paga a C». Primero empareja deudas
  exactas (un pago deja a dos a cero) y luego el que más debe le paga al que más le deben. Salen
  como mucho n−1 pagos.
- Al pulsar **Pagado**, se apunta un reembolso: es un gasto más (paga uno, «consume» el otro), que
  es lo que hace que el balance cuadre sin casos especiales.
- A quien ya sale en gastos de un grupo no se le puede sacar del grupo: su deuda quedaría huérfana.

## Arranque

```bash
npm install
npm run android      # instala y abre en un móvil conectado por adb
npm run typecheck    # tipos de la app y de los scripts de verificación
npm run verify       # comprueba la capa de datos
```

Hace falta JDK 17, Android SDK con API 36 y `adb`.

> Gradle pide un toolchain de **Java 17**. Si falla con «Cannot find a Java installation matching
> languageVersion=17» teniendo un JDK más nuevo, apunta al que Gradle ya se descargó:
>
> ```bash
> export JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2
> ```

## Compilar un APK

```bash
npm run build:apk                    # todas las arquitecturas
./scripts/build-apk.sh --compartir   # solo arm64-v8a, para repartir
# → android/app/build/outputs/apk/release/app-release.apk
```

Tiene que ser **release**, no debug: en debug el JavaScript no va dentro del APK, se carga del
servidor de Metro, así que un APK de debug no funciona sin el ordenador delante.

Instalar: `adb install -r app-release.apk`. Con `-r` se instala **encima** conservando los datos,
siempre que la firma sea la misma.

### ⚠️ El keystore hay que guardarlo como oro

La firma vive en `release.jks` + `keystore.properties`, los dos fuera del repo (en `.gitignore`).

Android solo deja instalar un APK **encima** de otro si van firmados con la misma clave. Si se
pierden, la única salida es **desinstalar** para poner la versión nueva — y desinstalar **borra los
datos de la app**.

Guárdalos junto a las copias de seguridad. Es lo único de este proyecto que no se puede regenerar.

## Verificación de la capa de datos

Los datos son la parte que no puede fallar, así que se prueban ejecutando **el mismo código que
corre en el móvil** contra un SQLite de escritorio:

```bash
npm run verify:data       # copia: ida y vuelta de las 11 tablas, huecos, volumen, rechazos, contraseña fuera
npm run verify:library    # reglas: dinero, repartos, saldar deudas, sushi, bebida, cuadrilla
npm run verify:migration  # que actualizar de versión deja el mismo esquema y no pierde nada
```

Algunas cosas que comprueban, porque son las que fallarían en silencio:

- Que la copia cubre **todas** las tablas del esquema (con trece, olvidar una al añadirla es fácil).
- Miles de repartos al azar: la suma es siempre el total y nadie se aleja más de un céntimo de su
  parte exacta.
- 500 grupos con saldos al azar: tras los pagos sugeridos, **todos a cero** y nunca más de n−1
  pagos.
- Veinte toques seguidos en «+1» suman veinte: la suma se hace en SQL, no leyendo y escribiendo.
  El marcador del mus lo aprende por las malas: una primera versión con transacción (leer, sumar,
  escribir) reventaba con `SQLITE_BUSY` al recibir toques a la vez; la versión buena es una única
  sentencia `UPDATE` con `CASE`, sin transacción ni lectura previa.

Esto es posible porque la lógica pide la base de datos a [`src/lib/dbRef.ts`](src/lib/dbRef.ts) en
vez de crearla ella: [`src/lib/db.ts`](src/lib/db.ts) es el **único** fichero que toca
`expo-sqlite`.

Se usa **libsql** y no `better-sqlite3` porque este último es sincrónico y no admite transacciones
asíncronas, mientras que `expo-sqlite` sí: con libsql la semántica coincide con la real.

## Copia automática a Nextcloud

En **Ajustes → Copia automática a Nextcloud**: dirección, usuario, contraseña y carpeta. Al abrir o
cerrar la app estando en WiFi sube sola, como mucho una vez cada 12 horas, con un fichero por día.

Usa una **contraseña de aplicación** de Nextcloud (Ajustes personales → Seguridad), no la de la
cuenta: se revoca sola. Esa contraseña **no se incluye nunca** en las copias exportadas.

No es una tarea en segundo plano: Android las mata sin avisar y encima no se ve si funcionan. Si la
copia automática lleva más de 4 días sin llegar, sale un aviso.

Un Nextcloud casero suele ir por `http://`, que Android bloquea por defecto: por eso `app.json`
lleva `usesCleartextTraffic`.

## Estructura

```
app/
  (tabs)/             Sushi · Bebida · Mus · Gastos · Cuadrilla · Ajustes
  sushi/[id].tsx      una sesión de buffet, con los contadores
  sushi/edit.tsx      nueva sesión / editar fecha y sitio
  drinks/…            igual, para la bebida
  mus/[id].tsx        una partida en vivo: marcador a dos bandas con «+1»
  mus/edit.tsx        nueva partida (elegir parejas) / editar meta y nota
  group/[id].tsx      un grupo de gastos: Gastos | Saldos
  group/edit.tsx      nuevo grupo / nombre y miembros
  expense/edit.tsx    nuevo gasto / editar, con los tres modos de reparto
  person/[id].tsx     ficha de alguien: sus números en todo
src/
  types.ts            modelo de dominio y forma del fichero de copia
  lib/                datos y reglas, sin nada nativo salvo db.ts, backup.ts, autoBackup.ts
    money.ts          céntimos, leer/escribir importes, repartir sin perder céntimos
    expenses.ts       grupos, gastos, saldos y pagos mínimos
    sushi.ts          sesiones, contadores y estadísticas
    drinks.ts         tipos, sesiones, contadores y estadísticas
    mus.ts            partidas, marcador atómico en SQL y estadísticas
    people.ts         la cuadrilla
  hooks/              consultas reactivas (useLiveQuery)
  ui/                 tema y primitivas: nada de colores ni medidas a ojo fuera de theme.ts
  components/         piezas con lógica propia (bienvenida, clasificación, Nextcloud…)
verify/               pruebas de la capa de datos contra un SQLite de escritorio
```

## La dirección de diseño

«Sala oscura», como las demás Ludok: interfaz **monocroma**, sin color de acento; la jerarquía la
marca el contraste. Aquí no hay carátulas ni fotos, así que lo que destaca son las **cifras**: el
contador grande de cada persona y los saldos.

El color solo aparece con significado: rojo para borrar, ámbar para los avisos de copia, y **verde
/ naranja** para «le deben» / «debe» en los saldos, que es el único sitio donde el color es el dato.

Los contadores están pensados para usarse en la mesa: el «+» es grande y sólido, el «−» pequeño y
solo con borde, y la lista **no se reordena** mientras se suma (si no, la tarjeta se movería debajo
del dedo). Tocar el número deja corregirlo a mano.
