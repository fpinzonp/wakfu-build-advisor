# Wakfu Build Advisor

Recomendador de equipamiento para Wakfu: indicas nivel, clase, tipo de juego (tanque, curas,
daño a distancia o cuerpo a cuerpo) y elementos, y la app busca la mejor combinación de objetos
entre todo el equipamiento oficial, además de un reparto de aptitudes.

## Uso

```bash
npm install
npm run data   # descarga los datos oficiales del CDN de Ankama -> public/data/items.json
npm run dev    # http://localhost:5173
```

Vuelve a ejecutar `npm run data` tras cada actualización del juego.

Los efectos de las sublimaciones y dónde se consiguen vienen de [wakfu.wiki.gg](https://wakfu.wiki.gg)
(CC BY-SA). Se guarda una copia local en `data/wiki-cache.json` y `npm run data` usa esa copia sin
conectarse a la wiki. Para actualizarla:

```bash
npm run data -- --refresh-wiki
```

Si la wiki no responde, se mantiene la copia anterior.

## Cómo funciona

- `scripts/build-data.mjs`: lee `items.json` del CDN oficial (`wakfu.cdn.ankama.com/gamedata`) y
  traduce cada efecto (`actionId`) a una estadística (PA, PM, dominios, resistencias…).
- `src/lib/optimizer.ts`: puntúa una build con
  - salida esperada: `(1 + dominio/100)` combinada con la probabilidad y el dominio crítico,
  - supervivencia: PdV efectivos con resistencias (`1 - 0,8^(res/100)`) y anticipación,
  - objetivos de PA/PM/alcance (muy valiosos hasta el objetivo, poco por encima),
  - pesos distintos según el rol.

  Busca la mejor combinación con ascenso por coordenadas y reinicios aleatorios, respetando:
  una reliquia, un épico, dos anillos distintos y armas a dos manos sin segunda mano.
- `src/lib/aptitudes.ts`: puntos de aptitud por nivel y reparto recomendado según el rol.
- `src/lib/spells.ts` y pestaña **Hechizos**: baraja de 12 activos y hasta 6 pasivas (ranuras en los niveles
  10, 30, 50, 100, 150 y 200). Los hechizos vienen de la tabla `Class_spells` de wakfu.wiki.gg
  (`public/data/spells.json`, textos en inglés). Los efectos **permanentes** de las pasivas (p. ej. Motivación:
  +1 PA, −20 % daños) están curados a mano en `data/spell-stats.json` y se suman a las características y al
  optimizador; los condicionales (al final del turno, en un estado…) y los buffs de los activos no se modelan.
  La baraja va dentro del enlace de la build.

## Idiomas (español, inglés y francés)

- Interfaz: `src/locales/{es,en,fr}.ts` (`es.ts` define todas las claves) y `src/lib/i18n.ts` (`t()`, selector y
  formato de números). El idioma se recuerda en el navegador; por defecto se usa el del navegador.
- Datos del juego: `npm run data` genera `public/data/lang/{es,en,fr}.json` con los nombres oficiales de Ankama
  (objetos, ingredientes, oficios, runas, sublimaciones) y los textos traducidos. `src/lib/localize.ts` los aplica.
- Traducciones propias (la wiki solo está en inglés): efectos de sublimaciones en `data/wiki-es.json` y
  `data/wiki-fr.json`, y nombres y efectos de hechizos en `data/spells-es.json` y `data/spells-fr.json` (clave: texto en
  inglés). Los nombres de hechizos no son los oficiales del juego. Si la wiki cambia un texto, `npm run data` avisa
  de lo que falta por traducir y lo muestra en inglés.

Limitaciones: no modela efectos especiales de objetos, sublimaciones ni runas; los pesos son
heurísticos y se pueden ajustar en `ROLE_WEIGHTS`.
