# Nombres de monstruos traducidos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Nombres de monstruos y familias en el idioma elegido en drops, simulador y mazmorras.
**Spec:** `docs/superpowers/specs/2026-11-13-nombres-mobs-design.md`

## Review Focus
- Nombre inglés sin traducción -> se muestra en inglés.
- Familia de la wiki con sufijo " (family)" o vacía.
- Buscar en el simulador por el nombre inglés con la interfaz en español sigue encontrando el mob.
- Escapes `\uXXXX` y espacios finales en los .properties.

### Task 1: Extracción (`scripts/mob-names.mjs`, `scripts/mob-names.test.mjs`, `package.json`)
- Produces: `export function parseProperties(text): Map<string,string>`; `export function buildNames(en, es, fr): { monsters, families }`.
- [ ] Tests: `parseProperties` (claves `content.7.1=Gobball`, `\u00e9` -> é, recorta espacios); `buildNames` (cruza por id, traducción más frecuente gana, ignora claves que no son 7/38).
- [ ] Ver fallar, implementar (lector zip con `zlib.inflateRawSync`), ver pasar.
- [ ] `npm run mob-names` -> escribe `data/mob-names.json` con miles de monstruos; Gobball -> Jalató / Bouftou.
- [ ] Commit.

### Task 2: Datos y pantalla
- Modify: `scripts/build-data.mjs` (lang files), `src/lib/i18n.ts` (`LangData.mobs?`, `families?`, `mobName`, `familyName`), `src/DropList.tsx`, `src/SimTarget.tsx`.
- [ ] Tests: `DropList` en español muestra "Jalató" para "Gobball" con nombres cargados vía `setNames`; `mobOption` traduce nombre y familia; sin traducción queda en inglés.
- [ ] Ver fallar, implementar, ver pasar; `npm run data`; suite, `tsc -b`, `npm run build`.
- [ ] Commit.

### Task 3: Mazmorras
- [ ] Cruzar cada `name` de piezas boss/mob de `src/lib/dungeons/data/*.ts` con el cliente (por fr/en), corregir es/en/fr y quitar marcas resueltas.
- [ ] Suite verde; commit.
