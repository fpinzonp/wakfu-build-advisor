# Equipos: recomendación basada en las mazmorras — diseño

Fecha: 2026-11-12

## Intención

Francisco va a empezar a jugar y quiere decidir qué personajes subir. La sección "Equipos" hoy recomienda un grupo según cuatro tipos de contenido genéricos (salas, Stasis alta, jefe último, trío), sin mirar las mazmorras reales que la app ya tiene cargadas en la sección "Mazmorras". Quiere que la recomendación salga de esas mazmorras:

1. **Un equipo base** que cubra la mayor cantidad posible de mazmorras, para decidir con qué grupo empezar.
2. **Para las que no cubre**, qué cambiar (una clase por otra), para poder ir ajustando el grupo más adelante según la mazmorra a la que vaya.

Lo que la haría un fracaso aunque funcione: que diga "cubierta" en una mazmorra cuya mecánica el equipo no puede hacer (por ejemplo, hay que acercar algo al jefe y nadie del grupo puede mover piezas), o que las exigencias sean inventadas en vez de salir de la guía.

## Objetivos

- La sección "Equipos" se arma a partir de las mazmorras de `src/lib/dungeons` (las 27 de `DUNGEONS`).
- El usuario elige **su clase y su rol** (como hoy). Se le propone un **equipo base de 6** que incluye su clase y que maximiza las mazmorras cubiertas.
- **Cobertura** mostrada como **total general** ("22 / 27 mazmorras") y **por franja de nivel** (una barra por tramo, p. ej. "66–80 · 2/3").
- **Lista de mazmorras por franja, plegable** (opción B del boceto): las franjas completas aparecen cerradas; las que tienen alguna mazmorra sin cubrir aparecen abiertas.
- Para cada mazmorra sin cubrir: **qué falta** (en palabras: "falta resurrección", "hay que atraer una pieza hacia el jefe") y **un cambio de una sola clase** que la arregla, con el total resultante ("Cambia Ocra → Zurcarák · cubre 23/27").
- **Clic en un cambio sugerido lo aplica** al equipo y se recalcula todo (cobertura, franjas, sugerencias). Se puede deshacer.
- Mazmorras para menos de 6 personajes: se indica **qué subgrupo del equipo llevar** (p. ej. "Grupo de 3: Yopuka, Feca, Aniripsa"); la mazmorra cuenta como cubierta si ese subgrupo cumple sus exigencias.
- Todo en los tres idiomas (es, en, fr).
- Aviso visible: exigencias tomadas de guías, no comprobadas en el juego (igual que el simulador y las mazmorras).

## Fuera de alcance

- Mazmorras que no están en `DUNGEONS` (las de `EXCLUDED`, ultimes, 186+). Cuando se agreguen mazmorras nuevas, deben traer sus exigencias.
- Elegir nivel del personaje o filtrar por tramo: se muestran todas las franjas siempre.
- Equipo, características o builds de cada personaje: solo clase y rol.
- Simular combates: la cobertura es una comparación de exigencias contra lo que aporta cada clase, no un cálculo de daño.

## Exigencias por mazmorra (dato nuevo)

Cada mazmorra lleva una lista curada a mano de lo que exige, sacada de su guía (`guide`) y de las salas y pasos ya escritos en su archivo de datos. Cada exigencia es:

- una **necesidad** (las actuales: protección, curas, resurrección, bajar resistencias, apoyo, control, daño cuerpo a cuerpo, daño a distancia, más la nueva **colocación**, ver abajo);
- **obligatoria** (sin ella la mazmorra queda "sin cubrir") o **recomendada** (solo afecta al desempate);
- opcionalmente un **nivel mínimo** de aporte (1-3, la misma escala de `power` de `KIT`) cuando la guía deja claro que hace falta algo fuerte;
- una **frase corta en los tres idiomas** con el motivo, que es lo que ve el usuario ("El jefe solo es vulnerable si un tentáculo está a su lado: hay que atraerlo").

Además, cada mazmorra declara su **tamaño de grupo** máximo cuando no es 6 (hay mazmorras de 3; las brechas llegan a 4).

Regla de curación: solo se anota una exigencia si la guía o los pasos ya escritos la sostienen. Si una mazmorra no exige nada en concreto, no lleva exigencias obligatorias y cuenta como cubierta con cualquier equipo que tenga daño. Una exigencia dudosa va como recomendada, no como obligatoria, y con un comentario en el código que diga de dónde sale.

## Colocación (necesidad nueva)

Muchas mecánicas piden mover piezas: empujar al jefe a una casilla, atraer un monstruo u objeto hacia el jefe, intercambiar posiciones, teletransportar. Se añade la necesidad **colocación** con subtipos: **empujar**, **atraer**, **intercambiar**, **teletransportar**.

- En `KIT` se añade, por clase, qué subtipos puede hacer y con qué hechizo, curado desde `public/data/spells.json` con la misma regla que el resto de `KIT` (solo efectos claros, con id de hechizo, nota en tres idiomas y rol si aplica).
- Una exigencia de colocación indica el subtipo que pide la mazmorra (o "cualquiera" si la guía no lo precisa). Se cumple si alguien del grupo tiene ese subtipo.
- Ya existe un `move` con `path` en los pasos de las mazmorras: sirve de pista para saber qué mazmorras piden colocación, pero el subtipo se decide leyendo la guía.

## Cómo se calcula

- **Mazmorra cubierta**: el grupo (o el mejor subgrupo del tamaño de la mazmorra que incluya al usuario) cumple todas sus exigencias obligatorias, usando la cobertura actual de `coverage()` y, para colocación, el subtipo pedido.
- **Equipo base**: el que, incluyendo la clase y rol del usuario, cubre más mazmorras; a igualdad, gana el que mejor cumple las recomendadas, y después el que más puntúa con la puntuación general actual. Se puede reutilizar la búsqueda de `recommendTeam` (añadir por ganancia y luego probar cambios uno a uno) con la nueva puntuación.
- **Cambio sugerido** para una mazmorra sin cubrir: entre todos los cambios de una sola clase (no la del usuario, ni las que ya están), los que la dejan cubierta; se muestra el que deja el **total más alto**. Si ninguno la arregla con un solo cambio, se dice qué falta sin sugerir cambio.
- Clase y rol del sustituto: el mejor rol de esa clase para ese hueco (como `bestRole`).

## Pantalla

De arriba abajo:

1. Controles: **Tu clase** y **Tu rol** (como hoy). Desaparecen los selectores de "Tamaño del grupo" y "Contenido".
2. **Equipo base**: los 6 personajes, como la lista actual, con su detalle al seleccionar uno (por qué está, qué aporta con sus hechizos, alternativas, "Hacer build"). Esto se conserva.
3. **Cobertura**: total grande ("22 / 27 mazmorras cubiertas") y una barra por franja de nivel.
4. **Mazmorras por franja** (opción B): una sección plegable por tramo con su "n/m". Dentro, primero las sin cubrir (⚠, qué falta, cambio sugerido como botón con el total resultante; subgrupo a llevar si es de menos de 6), luego las cubiertas en una línea (✓ nombres). Cada mazmorra enlaza a su vista en la sección "Mazmorras".
5. Aviso de que las exigencias vienen de guías.

Al aplicar un cambio (desde una sugerencia o desde las alternativas del detalle): aviso con "Deshacer" y, en vez de "necesidades perdidas", **qué mazmorras se ganaron y cuáles se perdieron** con el cambio.

## Decisiones del diseñador (no confirmadas por Francisco)

- La vista por mazmorras **reemplaza** los cuatro tipos de contenido (salas, Stasis, jefe último, trío); no quedan como modo alternativo.
- El equipo base es siempre de 6; las mazmorras más pequeñas se resuelven con subgrupos.
- Las 3 mazmorras de `EXCLUDED` no cuentan.
- Las franjas son las de `byTier()`.
- **Umbral de una exigencia obligatoria**: se cumple con estado "ok" (cobertura ≥ 2, como `needStatus`), salvo que la exigencia declare otro nivel mínimo. Las bases por rol de `memberPower` siguen contando (un rol de daño cuenta como daño 3); las de tanque y curandero valen 1, así que por sí solas no llegan a "ok".
- **Exigencias que piden más de un personaje**: cada exigencia lleva un `count` opcional (por defecto 1) = cuántos personajes distintos del grupo deben tener esa necesidad a nivel suficiente (p. ej. dos que puedan mover piezas en el mismo turno). Se usa solo si la guía lo dice.
- **Tamaño de grupo**: 6 salvo que la guía o los datos ya escritos digan otra cosa; si se anota uno menor, con comentario de dónde sale.
- **Pesos de la puntuación general** (desempate final, `mainNeed`, `bestRole`, `replacements`): se usan los pesos actuales de `rooms`; los otros contenidos y sus textos se eliminan.
- **Clases fijadas a mano (`pins`)**: se conservan como hoy. Aplicar un cambio sugerido o una alternativa fija la clase nueva. Las sugerencias por mazmorra pueden proponer sacar una clase fijada (es el usuario quien decide al hacer clic). Cambiar de clase o rol rehace el equipo base y borra las fijadas, como hoy.

## Lo que queda al constructor

- Dónde viven las exigencias (en cada archivo de `data/` o en un archivo aparte) y sus tipos.
- Textos y claves de i18n.
- Cómo se ve el detalle de cada mazmorra dentro de la franja, siguiendo los estilos actuales de la app.
- Tests: al menos que cada mazmorra de `DUNGEONS` tiene exigencias declaradas (aunque sea lista vacía), que cada aporte de colocación apunta a un hechizo existente de su clase, y casos del cálculo de cobertura, equipo base y cambio sugerido.
