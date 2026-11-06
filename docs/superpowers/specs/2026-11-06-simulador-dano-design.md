# Simulador de daño y apoyo: diseño

Fecha: 2026-11-06

## Intención

Francisco quiere saber cuánto pegan sus hechizos con la build que tenga abierta: elegir un mob como objetivo, armar una secuencia de hechizos y movimientos en un mapa, reproducirla y ver cuánto hace cada golpe. La referencia es la pestaña de simulación de Waksim.

El valor está en poder fiarse del número. Lo que convertiría esto en un fracaso aunque funcione: que los beneficios de los combos del Yopuka se calculen mal, que el daño por la espalda no suba cuando debe, o que el Sacrogrito no reciba el aumento de berserker. Por eso la tabla explica cada golpe y nunca presenta como exacto algo que no se calcula.

Además, Francisco quiere poder probar curas y escudos entre dos personajes, cuando le interese: uno lanza y otro recibe, y el resultado depende de las estadísticas de ambos.

## Objetivos

- Pestaña "Simulador" dentro de la vista de build, junto a Equipo, Características y Baraja.
- Modo normal: un personaje a la vez, con la build y la baraja abiertas, contra un solo objetivo.
- Modo de apoyo, opcional: se añade un segundo personaje en el mapa, desde una build guardada, para ver curas y escudos entre ambos.
- Objetivo elegido entre los mobs del juego, con sus características editables.
- Mapa de 11×11 con movimiento y orientación.
- Secuencia de varios turnos, que se reproduce paso a paso.
- Tabla con cada golpe: hechizo, posición (frente, lado, espalda), motivo y daño.
- Total del turno y de la secuencia: sin crítico, con crítico y promedio según el % de crítico.
- Si cambia la build, el daño se recalcula sin rehacer la secuencia.
- Interfaz en español, inglés y francés, como el resto de la app.

## Fuera de alcance

- Tres o más personajes en el mismo combate.
- Varios objetivos o daño a otros enemigos en una zona.
- Obstáculos en el mapa.
- IA del mob o daño recibido por el personaje a manos del mob.
- Optimización automática de la secuencia.
- Compartir la secuencia en el enlace de la build.

## Pantalla

Sigue el mockup B, "desglose protagonista", con la paleta y los componentes de la app.

- **Columna izquierda, estrecha:** objetivo, mapa y baraja.
- **Columna derecha, principal:** PA, PM y PW restantes, y Concentración o PV según la clase; debajo, la tabla de pasos y los totales.
- Controles de reproducción: inicio, anterior, siguiente, reproducir y en vivo. Seleccionar una fila muestra el mapa en ese paso.
- En móvil las columnas se apilan y la página no tiene scroll horizontal.

## Comportamiento

**Secuencia**
- Cada paso es un hechizo, un movimiento, un fin de turno o un ajuste manual (PV, orientación, estado).
- Se respetan PA, PM, PW, alcance, línea de visión y usos por turno. Si algo no se puede lanzar, no se añade y se dice por qué.
- Al terminar el turno se recuperan los PA y PM. Los PW no se rellenan: lo que quede pasa al turno siguiente y cada personaje solo recupera los "PW por turno" que se le indiquen (0 por defecto, porque depende de la clase y de sus pasivas), sin pasar del máximo. Ningún origen de PW supera el máximo, tampoco el evento de Concentración.
- Un ajuste manual de PW permite cambiarlos a mitad de secuencia.
- Concentración, Preparación, PV y estados continúan según su duración.

**Fórmula**, de la [guía de WakfuCalc](https://sites.google.com/view/wakfucalc/en/guides/formulas):

```
daño = base × (1 + maestrías / 100) × posición × (1 + % daño infligido / 100) × (1 − % resistencia / 100)
```

- `base`: daño normal o crítico del hechizo al nivel del personaje. El valor crítico de la wiki ya incluye el ×1,25, así que no se vuelve a multiplicar. Lo mismo vale para curas y armadura: quitar el término `crítico` de sus fórmulas al usar los valores críticos de la wiki.
- `maestrías`: elemento + melé (a 1-2 casillas) o distancia (a 3 o más) + berserker si procede + crítica en golpe crítico + espalda si procede.
- `posición`: ×1 de frente, ×1,1 de lado, ×1,25 por la espalda.
- `% resistencia`: se reutiliza `resistancePct` de `src/lib/characteristics.ts`, con la resistencia del elemento más la de espalda o crítico cuando apliquen.

**Yopuka**
- Los combos se detectan por el orden de costes definido en el módulo de estados de la wiki:
  - Robo de vida: 1 PM > 3 PA > 3 PA
  - Empuje: 1 PA > 1 PA > 2 PA
  - Preparación: 1 PM > 1 PM > 1 PW
  - Daño extra: 2 PA > 1 PA > 1 PM
  - PA: 1 PW > 3 PA > 1 PW > 1 PA
- Cada combo completado aplica su efecto al último hechizo y suma 5 de Concentración, salvo con la pasiva Disipación.
- Cada hechizo suma su Concentración. Al llegar a 100: +1 PW, +4 de Preparación, el estado asociado y −100 de Concentración.
- Preparación: el siguiente hechizo de daño gana +1 % de daño infligido por nivel.
- La pasiva Alarde hace que el evento de 100 de Concentración no dé PW; la Preparación se conserva.
- Los hechizos que dependen de estos estados (Trueno, Ira de Yopuka, Juicio y similares) se calculan con sus reglas.
- Golpe adicional: Trueno e Ira de Yopuka guardan un golpe diferido al darle al mob, y se emite como fila extra, con el cálculo normal de daño, en el paso en que ocurra el siguiente evento de 100 de Concentración (por ganancia de hechizo o por combo), incluido el del propio hechizo. Un nuevo lanzamiento sustituye su golpe pendiente, los de hechizos distintos son independientes y persisten entre turnos hasta dispararse. Va marcado "Golpe diferido" y "Sin confirmar", porque en el juego no está confirmado si se acumulan ni el momento exacto. Un ajuste manual de Concentración no dispara eventos.

**Sacrogrito**
- Los PV en % se ajustan a mano y bajan con los efectos propios de la secuencia, como el retorno de llama y Punición.
- Por debajo del 50 %, el personaje está en berserker: suma su maestría berserker y usa los "efectos si berserker" de cada hechizo.
- Si un hechizo daña antes al objetivo que al lanzador, ese golpe no recibe berserker. Si el daño propio ocurre primero, sí.
- La armadura se registra para Pie Rocoso y Aplastar. La pasiva Corazón de Sacrogrito suma las maestrías de melé y distancia.

**Modo de apoyo**
- Por defecto el simulador tiene un personaje. El botón "Añadir aliado" coloca un segundo personaje, elegido entre las builds guardadas.
- Cada paso indica quién actúa. Cada personaje tiene sus PA, PM, PW, PV y baraja, y ambos pueden lanzar cualquier hechizo de la suya.
- Un hechizo se dirige al mob, al aliado o a uno mismo, y la tabla indica a quién.
- Las filas muestran daño, curación o armadura, y hay un total de cada tipo por personaje.
- La curación aplicada se limita a los PV que faltan. La tabla muestra también el valor bruto. La armadura se muestra como una barra aparte de los PV.

Fórmulas, de la misma guía:

```
cura = base × (1 + maestrías / 100) × crítico × (1 + (% cura realizada + % cura recibida) / 100) × (1 − resistencia a curas / 100) × (1 − Incurable / 100)
armadura = base × crítico × (1 + (% armadura dada + % armadura recibida) / 100) × (1 − Friable / 100)
```

- `maestrías` de cura: elemento + melé o distancia + berserker si procede + crítica en golpe crítico + maestría de curación.
- La distancia de melé o de distancia se mide hasta quien recibe.
- `% armadura dada` no se aplica cuando uno se lanza armadura a sí mismo.
- La armadura de un personaje no supera el 50 % de sus PV máximos.
- Resistencia a curas: cada cura suma `(cura recibida / PV máximos del objetivo) × 20` y solo se aplica la parte entera.
- El robo de vida también cuenta como cura.

**Transparencia**
- Cada golpe muestra los modificadores aplicados.
- Lo que no se calcula sale avisado en su fila, en lugar de omitirse en silencio.

## Datos

Hay que ampliar `scripts/build-data.mjs` y su caché.

- **Hechizos:** desde las páginas de wakfu.wiki.gg, coste (PA, PM, PW), alcance, línea de visión, usos por turno, daño crítico y zona. Los campos ya están confirmados en Flecha Ardiente.
- **Mobs:** nuevo `public/data/mobs.json` desde `Category:Monsters`: nombre, familia, nivel, PV, PA, PM y resistencias. Se carga solo al abrir el simulador. Un rango de valores se interpola según el nivel elegido.
- **Estados y combos:** desde `Module:Wakfu_tooltip/states`, que ya se descarga.

## Decisiones de construcción

- El cálculo vive en funciones puras en `src/lib/`, separado de la interfaz: `simular(secuencia, contexto) → pasos`, para poder recalcular al cambiar la build y probarlo sin navegador.
- El motor trabaja desde el principio con una lista de personajes, con uno o dos elementos, para no tener que rehacerlo para el modo de apoyo.
- Las reglas de clase son módulos aparte por clase, de modo que se puedan sumar clases sin tocar el motor.
- La primera versión cubre el daño, las curas y la armadura de hechizos normales en las 18 clases, y las mecánicas completas de Yopuka y Sacrogrito.
- Las curas y armaduras con condiciones propias de una clase se avisan en su fila hasta que se añadan.

## Decisiones tomadas por el autor (revisables)

- **Combo de daño extra:** la wiki no da la cifra. Será un porcentaje editable que empieza en 0 % y se marca "sin confirmar" en cada golpe afectado.
- **Andar y combos:** los pasos de PM del combo los cuentan los hechizos que cuestan PM. Andar no cuenta. Hay que confirmarlo en el juego.
- **Lado o espalda:** con el objetivo mirando en una dirección, se decide por el eje con mayor distancia; las diagonales exactas cuentan como lado. Hay que confirmarlo en el juego.
- **Bloqueo, armadura y barrera del mob:** no entran en la primera versión. Los valores se pueden editar si en el futuro se añaden.
- **Resistencias de espalda y crítica del mob:** la ficha de la wiki no las trae. Empiezan en 0 y se pueden editar.
- **Maestrías de un objetivo y de zona:** la app no las contabiliza hoy. Comprobar si el juego las sigue usando; si es así, añadirlas a `ACTIONS` en `build-data.mjs` y a la fórmula.
- **Aliado:** viene de una build guardada. Sin builds guardadas, el botón explica cómo guardar una. Los dos personajes actúan en el orden de los pasos, sin turnos por iniciativa.
- **Secuencia:** se conserva mientras la pestaña está abierta. No se guarda en la build.

## Validación

- Pruebas unitarias de las fórmulas, la detección de combos, la posición, el umbral de berserker, el tope de armadura y la resistencia a curas.
- Comparar con golpes reales: anotar del juego build, hechizo, posición y objetivo para al menos un golpe normal, uno crítico y uno por la espalda de Yopuka, uno en berserker de Sacrogrito, y una cura y un escudo sobre un aliado.
- Hasta tener esa comparación, la fórmula se considera sin validar, aunque la tabla la muestre con normalidad y las pruebas pasen.
- Comprobar que el daño interpola bien por nivel. El texto "2-60" apunta a un rango por nivel, pero la app aún no tiene confirmado ese cálculo.

## A cargo de quien lo construya

- Estructura de componentes y estado de la pestaña.
- Algoritmo de línea de visión y búsqueda de ruta.
- Forma exacta de los JSON y de la caché.
- Reparto de los textos nuevos en los tres idiomas.
