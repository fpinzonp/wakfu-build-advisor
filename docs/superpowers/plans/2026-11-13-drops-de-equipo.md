# Drops de equipo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botón "Ver drops" en las piezas no crafteables que lista los monstruos que las sueltan con su %.

**Architecture:** `npm run data` descarga la tabla Cargo `Monster_drops` de wakfu.wiki.gg a la copia local, la cruza con los objetos por nombre inglés + rareza y escribe `public/data/drops.json`. La vista de build lo carga al montarse (como `recipes.json`) y un componente `DropList` lo muestra.

**Tech Stack:** Node (script .mjs), React + TypeScript, Vitest (renderToString).

**Spec:** `docs/superpowers/specs/2026-11-13-drops-de-equipo-design.md`

## Global Constraints
- Solo drops de monstruos; nada de misiones, logros, máquinas ni cofres.
- Sin consultas a la wiki desde la página.
- Nombres de monstruos en inglés, sin traducir.
- Botón solo para `src === 'other'` con drops conocidos; textos en es/en/fr.
- Orden por % descendente.

## Review Focus
- Objeto de la wiki sin sufijo de rareza (`"Dh Trophy"`) → se asigna a todos los ids con ese nombre inglés.
- Sufijo que no es una rareza (nombre con `/` propio) → se trata como parte del nombre.
- Monstruo que no está en los mobs descargados → se lista igual, sin tipo ni nivel.
- `rate` vacío o no numérico en la wiki → la fila se descarta.
- `drops.json` ausente o fallo de red → la tarjeta funciona como hoy, sin botón.

---

### Task 1: Descarga y emparejado de drops (script de datos)

**Files:**
- Create: `scripts/drops.mjs`, `scripts/drops.test.mjs`
- Modify: `scripts/build-data.mjs` (`fetchDrops()` junto a `fetchMobs` ~l.334; incluirlo en la descarga completa ~l.267 y en un bloque "copias antiguas sin drops" tras el de condiciones ~l.437; escribir `drops.json` junto al bloque de mobs ~l.700)

**Interfaces:**
- Produces: `export function linkDrops(rows: {monster: string, item: string, rate: string}[], items: {id: number, en: string, rarity: number}[], mobs: {name: string, type?: string, minLevel?: number, maxLevel?: number}[]): Record<number, Drop[]>` con `Drop = { monster: string, rate: number, type?: string, minLevel?: number, maxLevel?: number }`, cada lista ordenada por `rate` descendente.
- Produces: `public/data/drops.json` = `{ version, source, drops: Record<itemId, Drop[]> }`.

- [ ] **Step 1: Write the failing test** `scripts/drops.test.mjs`

```js
const items = [
  { id: 1, en: 'Zinit Cloak', rarity: 3 }, { id: 2, en: 'Zinit Cloak', rarity: 4 },
  { id: 3, en: 'Dh Trophy', rarity: 0 }, { id: 4, en: 'Dh Trophy', rarity: 2 },
];
const mobs = [{ name: 'Sweepney the Chim', type: 'Archmonster', minLevel: 150, maxLevel: 155 }];
it('empareja por nombre y rareza', () => {
  const d = linkDrops([{ monster: 'Sweepney the Chim', item: 'Zinit Cloak/Mythical', rate: '2' }], items, mobs);
  expect(d[1]).toEqual([{ monster: 'Sweepney the Chim', rate: 2, type: 'Archmonster', minLevel: 150, maxLevel: 155 }]);
  expect(d[2]).toBeUndefined();
});
it('sin rareza se asigna a todos los ids con ese nombre', () => {
  const d = linkDrops([{ monster: 'X', item: 'Dh Trophy', rate: '10' }], items, []);
  expect(d[3]).toEqual([{ monster: 'X', rate: 10 }]); expect(d[4]).toEqual([{ monster: 'X', rate: 10 }]);
});
it('ordena por % descendente y descarta % no numérico', () => {
  const rows = [{ monster: 'A', item: 'Dh Trophy', rate: '1' }, { monster: 'B', item: 'Dh Trophy', rate: '5' }, { monster: 'C', item: 'Dh Trophy', rate: '' }];
  expect(linkDrops(rows, items, [])[3].map((x) => x.monster)).toEqual(['B', 'A']);
});
it('un sufijo que no es rareza es parte del nombre', () => {
  const d = linkDrops([{ monster: 'X', item: 'AC/DC Ring', rate: '1' }], [{ id: 9, en: 'AC/DC Ring', rarity: 2 }], []);
  expect(d[9]).toHaveLength(1);
});
it('nombres se comparan sin mayúsculas ni apóstrofos tipográficos', () => {
  const d = linkDrops([{ monster: 'X', item: 'gobball’s hat/Rare', rate: '1' }], [{ id: 7, en: "Gobball's Hat", rarity: 2 }], []);
  expect(d[7]).toHaveLength(1);
});
```

- [ ] **Step 2: Run** `npx vitest run scripts/drops.test.mjs` — Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `linkDrops` en `scripts/drops.mjs`.** Rarezas por índice: `['Common','Unusual','Rare','Mythical','Legendary','Relic','Souvenir','Epic']`. Separar por el último `/` solo si el sufijo está en esa lista. Normalizar nombres como el bloque de condiciones (`toLowerCase`, `’`/`` ` `` → `'`, espacios colapsados). Mob por nombre normalizado; omitir `type`/niveles si no hay mob.

- [ ] **Step 4: Run** `npx vitest run scripts/drops.test.mjs` — Expected: PASS.

- [ ] **Step 5: Integrar en `build-data.mjs`.** `fetchDrops()` pagina `Monster_drops` (`fields: 'monster,item,rate'`, lotes de 500, `wikiJson`, `sleep(400)`) y se guarda como `wiki.drops`. Bloque "copias antiguas sin drops" con try/catch y aviso. Escribir `drops.json` con `items` = objetos de `out` (`en` de `enTitle`, `rarity`) y mobs = los ya generados para `mobs.json`; log `Drops: N objetos con drops`.

- [ ] **Step 6: Run** `npm run data` — Expected: termina sin error, log de drops con N > 0 y `public/data/drops.json` creado. Comprobar `node -e "console.log(require('./public/data/drops.json').drops[11412])"` muestra Sweepney the Chim.

- [ ] **Step 7: Commit**

```bash
git add scripts/drops.mjs scripts/drops.test.mjs scripts/build-data.mjs data/wiki-cache.json public/data
git commit -m "Datos: drops de monstruos desde la wiki"
```

### Task 2: Botón "Ver drops" en la tarjeta de equipo

**Files:**
- Create: `src/DropList.tsx`, `src/DropList.test.tsx`
- Modify: `src/lib/game.ts` (tipos `Drop`, `DropData`), `src/App.tsx` (~l.615-625 carga; ~l.780-790 botón y vista), `src/locales/{es,en,fr}.ts`

**Interfaces:**
- Consumes: `drops.json` de la Task 1.
- Produces: `export default function DropList({ drops }: { drops: Drop[] })`; claves `equip.showDrops`, `equip.hideDrops`, `drops.rate` (`"{n} %"`), `drops.level` (`"nv. {min}-{max}"`).

- [ ] **Step 1: Write the failing test** `src/DropList.test.tsx` (renderToString, `setLang('es')` como en `TeamsPanel.test.tsx`)

```tsx
it('lista monstruos con tipo, nivel y %', () => {
  const html = renderToString(<DropList drops={[{ monster: 'Sweepney the Chim', rate: 2, type: 'Archmonster', minLevel: 150, maxLevel: 155 }]} />);
  expect(html).toContain('Sweepney the Chim'); expect(html).toContain('150-155'); expect(html).toContain('2 %');
});
it('sin tipo ni nivel muestra solo nombre y %', () => {
  const html = renderToString(<DropList drops={[{ monster: 'X', rate: 0.5 }]} />);
  expect(html).toContain('X'); expect(html).toContain('0,5 %'); expect(html).not.toContain('nv.');
});
```

- [ ] **Step 2: Run** `npx vitest run src/DropList.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement.** `DropList` como lista con el estilo de `.recipe`; % formateado con el locale activo. En `App.tsx`: cargar `drops.json` en el mismo `useEffect` que recetas (fallo → `null`); estado `openDrops` análogo a `openRecipe`; botón `.link` con `aria-expanded` solo si `item.src === 'other'` y `drops?.drops[item.id]?.length`. Textos es/en/fr ("Ver drops"/"Ocultar drops", "Show drops"/"Hide drops", "Voir les drops"/"Masquer les drops").

- [ ] **Step 4: Run** `npx vitest run`, `npx tsc -b --noEmit`, `npm run build` — Expected: todo PASS, sin errores.

- [ ] **Step 5: Commit**

```bash
git add src docs/superpowers
git commit -m "Equipo: ver dónde se dropea cada pieza"
```
