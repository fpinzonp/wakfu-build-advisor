# Mazmorras: cómo quitar invulnerabilidades — diseño

Fecha: 2026-11-11

## Intención

Francisco se ha quedado atascado en mazmorras sin saber qué hacer exactamente para que un boss o sus mobs dejen de ser invulnerables. Las guías existen ([wakfu.guide](https://wakfu.guide/donjons/), MethodWakfu), pero están en francés, en texto, repartidas por páginas y no muestran la jugada. Quiere **ver exactamente qué hay que hacer**: qué pieza se mueve, a dónde, qué acción la dispara y cuándo cae la invulnerabilidad.

La solución: una sección nueva con un tablero animado por mazmorra que reproduce, paso a paso, la jugada que quita la invulnerabilidad (o las resistencias enormes equivalentes) en cada sala donde existe esa mecánica.

Lo que la haría un fracaso aunque funcione: que la animación muestre una jugada que no coincide con la guía (otra casilla, otra condición, otra duración), o que haya que leer un párrafo para entender el tablero.

## Objetivos

- Sección nueva **"Mazmorras"** en la barra superior, junto a "Builds" y "Equipos" (decisión del diseñador).
- Selector de mazmorra, agrupado por tramo de nivel, y selector de sala dentro de la mazmorra.
- Por cada sala con mecánica: tablero en **cuadrícula vista desde arriba** (opción A del boceto) con boss, mobs, piezas especiales y personajes.
- Reproducción paso a paso: ◀ anterior, ▶ siguiente, ▶ Reproducir (avance automático) y volver al inicio. Las piezas se desplazan con animación entre casillas.
- Cada paso lleva una frase corta que dice quién hace qué. La pieza que actúa se resalta.
- La invulnerabilidad se ve en el tablero: aura en la pieza invulnerable que desaparece cuando cae. Las zonas (explosión, glifo, choque, casillas que cambian de color) se pintan en el paso en que ocurren.
- Bajo el tablero, una línea de resumen: condición para quitarla y cuánto dura (p. ej. "1 turno").
- Todo — nombres de mobs, piezas, salas, frases de los pasos — en el idioma que el usuario tenga elegido (es, en, fr).
- Enlace a la guía de origen en cada mazmorra.
- Aviso visible, como en el simulador de daño: mecánicas y posiciones tomadas de guías, no comprobadas en el juego.

## Fuera de alcance

- Que el usuario mueva piezas o pruebe su propia jugada (solo se mira).
- Reglas del juego calculadas: nada de daño, PA, PM ni alcance real. Es una animación guionizada.
- Conexión con el simulador de daño o con las builds.
- Mazmorras sin información clara, boss ultimes, y mazmorras de 186+ en esta primera entrega.
- Mapas con la forma o el aspecto real de la sala.

## Contenido inicial

Mazmorras con mecánica clara según wakfu.guide (revisión del 2026-11-11). Se incluye la invulnerabilidad real y también las resistencias enormes que se quitan con una acción concreta.

| Tramo | Mazmorra | Mecánica |
|---|---|---|
| 36-50 | Equipage du Poulpe | Boss invulnerable bajo el agua: matar los 4 tentáculos |
| 36-50 | Tour Minérale | +300 res. del boss: destruir los 4 cristales elementales |
| 66-80 | Corbeau-Cave | Reflejo cada 6 golpes: lanzar cura/boost sobre el reflejo |
| 66-80 | Excarnus | Tótems: golpear en melé o a ≤3 PO, primero "terre maudite" |
| 66-80 | Truchière Abandonnée | Placar al boss y matar los huevos en 2 turnos |
| 81-95 | Scarrière Abandonnée | 99 % res.: matar el escarabajo del elemento del equipo |
| 81-95 | Caverne des Slekymoses | Glifo blanco → pasar turno → Slek → hechizo melé 4 PA |
| 96-110 | Repaire des Magik Riktus | Golpear por la espalda hasta 3 sombreros |
| 96-110 | Arène Dansante | Golpear desde la PO igual al estado de arritmia |
| 96-110 | Antre du Corbeau Noir | Matar corbac → hechizo especial sobre el boss (1 turno) |
| 111-125 | Pot d'Hagen-Glass | Armadura de hielo: quitar PA con choques o empujes |
| 111-125 | Caverne Smarrante | Golpear en melé (dura el turno del personaje) |
| 111-125 | Donjon Cacterre | 10 PA de daño de cada elemento |
| 111-125 | Antre du Dragon-Cochon | 30 PA por la espalda; luego frenesí 7 |
| 126-140 | Donjon Noirespore | Sala 1 y boss: matar el resto / matar su invocación |
| 126-140 | Compost du grand Potofeu | Pasar el veneno de la Berenjena en melé |
| 126-140 | Jawdin de la Weine | Boss en la explosión de una Cawotte a 1 PV (1 turno) |
| 141-155 | Source du Mal | Estado Mort Subite: Bulbiflore + glifo azul oscuro |
| 141-155 | Château du Wa Wabbit | Matar los 4 monstruos con el logo dorado |
| 141-155 | Donjon Enutrosor | Dañar el diamante blanco; gemas ×5 |
| 156-170 | Donjon Lampionaute | Empezar junto al dial → movimiento inverso a melé |
| 156-170 | Donjon Roub'Bar | Sala 1 y boss: muro de pólvora entre aliados bombificados |
| 156-170 | Donjon E-Bou | Pisar las casillas azules del borde hasta dejarlas rojas |
| 156-170 | Fabrique Méka | Empezar el turno en el glifo central azul oscuro |
| 171-185 | Donjon des Crocodailles | Sala 1 y boss: colisión (deslizamiento +3 casillas) |
| 171-185 | Donjon des Tropikes | Sala 1 y boss: explosión de Nodkoko a 1 PV |
| 171-185 | Donjon Gerbouille | Conducteur en melé desde las dos casillas del diagrama |

Cada mazmorra se incluye solo después de revisar su página completa (texto e imágenes). Si al revisarla la mecánica no queda clara, se deja fuera y se anota por qué. Se animan **todas las salas** de la mazmorra que tengan mecánica, no solo el boss.

## Datos

- Cada mazmorra es un archivo de datos escrito a mano dentro del código (decisión del diseñador: TypeScript tipado, uno por mazmorra, para que los errores de forma salten al compilar).
- Contenido de cada archivo: id, tramo de nivel, nombre en 3 idiomas, URL de la guía, y sus salas. Cada sala: nombre en 3 idiomas, tamaño de la cuadrícula, piezas iniciales, resumen (condición y duración) y la lista de pasos.
- Pieza: id, tipo (boss, mob, pieza especial, personaje), nombre en 3 idiomas, casilla, invulnerable sí/no, etiqueta opcional (p. ej. PV "1").
- Paso: frase en 3 idiomas, pieza que actúa, y cambios: mover piezas (con recorrido si importa, p. ej. deslizamientos), poner/quitar aura, cambiar etiqueta, quitar o añadir piezas, pintar una zona (casillas o radio, con su tipo: explosión, glifo, choque, casillas de color), y actualizar un contador visible (p. ej. "Fuego 10/10 PA" en Cacterre, "30/30 PA por la espalda" en Dragon-Cochon, "sombreros 2/3" en Magik Riktus).
- Un paso puede abarcar un turno entero cuando la mecánica se acumula en varios turnos; no hace falta animar cada golpe.
- Personajes genéricos (decisión del diseñador): no se ligan a una clase. Se muestran como "Personaje 1…n" y, si el papel importa, con una etiqueta de papel ("Empujador", "Conducteur", "Bombificado"). Solo se muestran los personajes que intervienen en la jugada.
- Nombres oficiales de mobs y piezas en es/en/fr tomados de la enciclopedia de wakfu.com en cada idioma. Si un nombre no existe en un idioma, se usa el francés.
- Los textos de la interfaz (botones, aviso, selectores) van en los archivos de idioma de la app, como el resto.
- Fuentes: wakfu.guide se puede descargar; MethodWakfu devuelve 403 a descargas automáticas. Los diagramas son imágenes: hay que descargarlas y mirarlas, no basta con el texto de la página. Si la enciclopedia de wakfu.com no se puede consultar para un nombre, se usa el nombre de la guía (francés) o el de `public/data/mobs.json` (inglés) y se anota como pendiente.
- Las posiciones son aproximadas, reconstruidas a partir de los diagramas de wakfu.guide. La cuadrícula no reproduce la forma real de la sala; basta con que la relación entre piezas (distancias, lados, alineaciones) coincida con la guía.

## Pantalla

- Arriba: selector de mazmorra (agrupado por tramo) y pestañas o selector de sala.
- Centro: tablero de cuadrícula, leyenda de colores y controles de reproducción.
- Debajo: frase del paso actual, número de paso ("2 / 4"), resumen de la sala, enlace a la guía y aviso de "no comprobado".
- Piezas distinguibles por color y forma, con nombre accesible (lector de pantalla) y el nombre visible al pasar el ratón o tocar.
- En móvil la página no tiene scroll horizontal; el tablero se ajusta al ancho.
- Respetar "reducir movimiento" del sistema: sin desplazamiento animado, solo cambio de estado.

## Lo que queda al constructor

- Estructura exacta de componentes y tipos.
- Estilo visual dentro de la paleta de la app.
- Velocidad de reproducción automática.
- Orden de incorporación de las mazmorras y cuántas por entrega.
- Pruebas: como mínimo, que cada archivo de mazmorra sea coherente (piezas referenciadas existen, casillas dentro de la cuadrícula, los 3 idiomas presentes) y que la reproducción aplique los cambios paso a paso.
