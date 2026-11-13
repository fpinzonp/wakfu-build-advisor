# Drops de equipo

## Intención
Las piezas que no se craftean muestran hoy solo la etiqueta "Drop / otros". Francisco quiere poder
abrir una pieza y ver qué monstruos la sueltan (y con qué probabilidad) para saber dónde farmearla.

## Objetivos
- En la tarjeta de una pieza con fuente "Drop / otros", un botón "Ver drops" que despliega la lista
  de monstruos que la sueltan: nombre, tipo (jefe/archimonstruo…), rango de nivel y % de drop,
  ordenados por % descendente.
- Si la wiki no registra ningún drop para la pieza, el botón no aparece.

## No objetivos
- Otras formas de obtención (misiones, logros, máquinas, cofres): elegido "solo drops" (opción A).
- Consultas en vivo a la wiki desde la página.
- Traducir nombres de monstruos (la wiki los tiene solo en inglés).

## Enfoques considerados
1. **Descarga al generar los datos (elegido):** `npm run data` baja la tabla Cargo `Monster_drops`
   de wakfu.wiki.gg, la guarda en `data/wiki-cache.json` y escribe `public/data/drops.json`; la
   página lo carga perezosamente como `recipes.json`. Robusto y rápido; se actualiza con la tarea diaria.
2. Consulta en vivo: siempre al día pero depende de la wiki en cada click. Descartado.

## Diseño
- Script (`scripts/build-data.mjs`): `fetchDrops()` pagina `Monster_drops` (monster, item, rate) como
  `fetchMobs`; se añade a la copia local con el mismo patrón de "copias antiguas sin X".
- Emparejado: el `item` de la wiki es `Nombre inglés/Rareza` (o solo `Nombre`); se cruza con el
  nombre inglés de `public/data/lang/en.json` + rareza del objeto. Solo objetos equipables de items.json.
- Salida `drops.json`: `{ version, drops: { [itemId]: [{ monster, rate, type?, minLevel?, maxLevel? }] } }`;
  tipo y niveles salen de los mobs ya descargados.
- UI (`App.tsx`, tarjeta de equipo): botón "Ver drops" junto a la etiqueta de fuente para `src === 'other'`
  con datos; se despliega igual que la receta. Textos en es/en/fr.

## Para quien lo construya
- Mapa exacto de rarezas de la wiki a los índices de `RARITIES`.
- Si un mismo nombre+rareza corresponde a varios ids, asignar los drops a todos.
