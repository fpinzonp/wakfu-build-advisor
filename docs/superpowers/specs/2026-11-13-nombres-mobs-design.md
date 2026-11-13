# Nombres de monstruos en el idioma del usuario

## Intención
Los nombres de monstruos (y familias) se muestran solo en inglés porque vienen de wakfu.wiki.gg. Francisco
quiere verlos en el idioma seleccionado en todos los lugares donde aparecen.

## Fuente
Textos oficiales del cliente de Wakfu instalado en este PC (`%LOCALAPPDATA%/Ankama/Wakfu/contents/i18n/i18n_{en,es,fr}.jar`,
`texts_{lang}.properties`): `content.7.<id>` = monstruos, `content.38.<id>` = familias. Solo existe en este PC, así que
se extrae a `data/mob-names.json` (en el repo) con `npm run mob-names`; la tarea semanal de GitHub usa esa copia.

## Diseño
- `scripts/mob-names.mjs`: lee los .jar (lector zip mínimo con zlib), cruza por id y guarda
  `{ source, extractedAt, monsters: { [en]: { es, fr } }, families: { [en]: { es, fr } } }`. Si un nombre inglés tiene
  varias traducciones, gana la más frecuente.
- `build-data.mjs`: añade `mobs` y `families` (nombre inglés -> nombre en el idioma) a `public/data/lang/{lang}.json`,
  solo con los monstruos de mobs.json y drops.json. Las familias de la wiki con " (family)" se buscan sin ese sufijo.
- Página: helpers `mobName(en)` y `familyName(en)` en `i18n.ts` (inglés si falta). Los usan `DropList` y `SimTarget`;
  el buscador del simulador indexa nombre traducido + inglés + familia traducida + inglesa.
- Mazmorras: corrección manual única de los nombres de jefes/monstruos en `src/lib/dungeons/data/*.ts` con los nombres
  oficiales; se quitan las marcas "nombre pendiente" resueltas. Nombres genéricos ("Boss de la Scarrière") se quedan.

## Enfoques considerados
1. **Nombres en los archivos de idioma (elegido):** mismo patrón que objetos y oficios.
2. Traducciones dentro de drops.json y mobs.json: repite datos y rompe el patrón. Descartado.

## No objetivos
Nombres de mazmorras, salas y textos de mecánicas.
