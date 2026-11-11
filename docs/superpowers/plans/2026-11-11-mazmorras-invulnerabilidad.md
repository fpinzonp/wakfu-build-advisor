# Mazmorras: cómo quitar invulnerabilidades — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sección "Mazmorras" con un tablero animado por sala que reproduce paso a paso cómo se quita la invulnerabilidad (o el bloqueo de daño equivalente) en 27 mazmorras de nivel 36 a 185.

**Architecture:** Cada mazmorra es un archivo TypeScript de datos guionizados (piezas iniciales + pasos con cambios). Una función pura `boardAt(room, i)` acumula los cambios hasta el paso `i` y devuelve el estado del tablero; un validador `checkDungeon` comprueba la coherencia de cada archivo en las pruebas. La interfaz (`DungeonPanel` + `DungeonBoard`) solo dibuja ese estado y controla la reproducción.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest (entorno node, pruebas de render con `react-dom/server`), CSS en `src/styles.css`, i18n propio en `src/lib/i18n.ts` + `src/locales/{es,en,fr}.ts`.

**Spec:** `docs/superpowers/specs/2026-11-11-mazmorras-invulnerabilidad-design.md`

## Global Constraints

- Solo se mira: nada de mover piezas, ni reglas del juego calculadas (daño, PA, PM, alcance).
- Vista de cuadrícula desde arriba; la forma real de la sala no se reproduce.
- Todo texto visible en es, en y fr: textos de la interfaz en `src/locales/*.ts` (los tres `Dict` deben tener las mismas claves; `en.ts`/`fr.ts` están tipados como `Dict` completo), nombres de mazmorras/salas/piezas y frases de los pasos dentro del archivo de cada mazmorra como `L10n`.
- Nombres oficiales de mobs y piezas de la enciclopedia de wakfu.com en cada idioma; si un nombre no existe o no se puede consultar en un idioma, se usa el francés de la guía (o el inglés de `public/data/mobs.json` para `en`) y se deja el comentario `// nombre pendiente: <idioma>` en esa línea.
- Una mazmorra entra solo tras revisar su sección completa de wakfu.guide, **incluidas las imágenes**. Si la mecánica no queda clara, va a `EXCLUDED` con su motivo.
- Se animan todas las salas de la mazmorra que tengan mecánica, no solo el boss.
- Aviso visible "no comprobado en el juego" y enlace a la guía en cada mazmorra.
- En móvil, sin scroll horizontal: el tablero se ajusta al ancho (tamaños en %, no en px fijos).
- `prefers-reduced-motion: reduce` → sin desplazamiento animado de piezas.
- Casillas en datos: base 0 (`Cell` de `src/lib/sim/formulas.ts`); en textos visibles, base 1.
- Áreas con radio: distancia Manhattan (rombo), como en Wakfu.
- Comentarios del código en español, como el resto del repo.

## Review Focus

- Cambiar de mazmorra o de sala con la reproducción en marcha o en un paso alto → el paso vuelve a 0 y la reproducción se para (sin índice fuera de rango). Prueba en Task 4 (`selectionReset`).
- Pulsar "Reproducir" estando en el último paso → empieza desde el paso 0; al llegar al último se para sola. Prueba en Task 4 (`playFrom`, `autoNext`).
- Cambiar de idioma con una mazmorra abierta → nombres de piezas, sala y frase del paso cambian al idioma nuevo. Prueba en Task 4 (render en `fr`).
- Dos piezas en la misma casilla tras un paso, o un cambio que apunta a una pieza ya quitada → el validador lo rechaza con un mensaje que nombra mazmorra, sala y paso. Prueba en Task 2.
- Salir de la sección con la reproducción en marcha → el temporizador se detiene (no avanza en segundo plano). Cubierto por `active` en Task 4: el efecto del temporizador depende de `active && playing`.

---

## Procedimiento de contenido (Tasks 3 y 5-10)

Para cada mazmorra:

1. Leer su sección en la página del tramo de `https://wakfu.guide/donjons/<tramo>/` con WebFetch (prompt: extraer salas, piezas, condiciones, duración y la lista de imágenes de la sección con su URL).
2. Descargar las imágenes de la sección a una carpeta nueva en el scratchpad (`curl -sL <url> -o <archivo>`) y mirarlas con Read. De ahí salen las posiciones relativas.
3. Nombres: buscar cada mob/pieza en `https://www.wakfu.com/fr/mmorpg/encyclopedie/monstres?text=<nombre>`, `https://www.wakfu.com/es/mmorpg/enciclopedia/monstruos?text=<nombre>` y `https://www.wakfu.com/en/mmorpg/encyclopedia/monsters?text=<nombre>`. Si falla, aplicar la regla de Global Constraints.
4. Escribir `src/lib/dungeons/data/<id>.ts` (forma en Task 1) y añadirlo a `DUNGEONS` en `src/lib/dungeons/index.ts`.
5. Frases de paso: una acción por frase, sujeto explícito ("El Personaje 1 empuja al boss 1 casilla hacia la Nodkoko"), ≤ 120 caracteres. El paso 0 siempre es la situación inicial, sin cambios, y nombra qué está invulnerable. El último paso dice que la invulnerabilidad cae y cuánto dura.
6. Ejecutar `npx vitest run src/lib/dungeons` → PASS.
7. Si no está clara: añadir `{ id, name, reason }` a `EXCLUDED` y no crear archivo.

---

### Task 1: Tipos y estado del tablero por paso

**Files:**
- Create: `src/lib/dungeons/types.ts`
- Create: `src/lib/dungeons/play.ts`
- Test: `src/lib/dungeons/play.test.ts`
- Add (commit con esta task): `docs/superpowers/specs/2026-11-11-mazmorras-invulnerabilidad-design.md`, este plan.

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  import type { Lang } from '../i18n';
  import type { Cell } from '../sim/formulas';
  export type L10n = Record<Lang, string>;
  export type PieceKind = 'boss' | 'mob' | 'special' | 'char';
  export type TileColor = 'red' | 'blue' | 'white' | 'dark';
  export type ZoneKind = 'explosion' | 'glyph' | 'collision' | 'path' | 'hit';
  export interface Piece { id: string; kind: PieceKind; name: L10n; role?: L10n; cell: Cell; invulnerable?: boolean; label?: string }
  export interface Zone { kind: ZoneKind; cells?: Cell[]; center?: Cell; radius?: number }
  export type Change =
    | { type: 'move'; piece: string; to: Cell; path?: Cell[] }      // path: casillas intermedias, se pintan como zona 'path' en ese paso
    | { type: 'aura'; piece: string; on: boolean }
    | { type: 'label'; piece: string; label: string | null }
    | { type: 'remove'; piece: string }
    | { type: 'add'; piece: Piece }
    | { type: 'zone'; zone: Zone }                                    // solo dura ese paso
    | { type: 'tiles'; cells: Cell[]; color: TileColor | null }      // persiste; null las limpia
    | { type: 'counter'; id: string; name: L10n; value: string | null }; // persiste; null lo quita
  export interface Step { text: L10n; actor?: string; changes: Change[] }
  export interface Room { id: string; name: L10n; size: { w: number; h: number }; pieces: Piece[]; tiles?: { cells: Cell[]; color: TileColor }[]; condition: L10n; duration: L10n; steps: Step[] }
  export interface Dungeon { id: string; tier: [number, number]; name: L10n; guide: string; rooms: Room[] }
  export interface Excluded { id: string; name: string; reason: string }
  ```
- Produces (`play.ts`):
  ```ts
  export interface BoardState {
    pieces: Piece[];                       // en el orden de aparición, sin las quitadas
    tiles: Record<string, TileColor>;      // clave `${x},${y}`
    zones: { kind: ZoneKind; cells: Cell[] }[];  // solo las del paso actual, ya expandidas
    counters: { id: string; name: L10n; value: string }[];
    actor?: string;
    text: L10n;
  }
  export function zoneCells(zone: Zone, size: { w: number; h: number }): Cell[];
  export function boardAt(room: Room, step: number): BoardState;  // aplica steps[0..step]; step se acota a [0, steps.length-1]
  ```

- [ ] **Step 1: Escribir las pruebas que fallan** en `play.test.ts`, con una sala de prueba 9×9: boss `b` en (4,3) invulnerable, Nodkoko `n` en (4,1) label "1", personaje `c` en (4,5); pasos: 0 sin cambios; 1 `move b → (4,2)` con `path: []` y actor `c`; 2 `zone explosion center (4,1) radius 2` + `label n "💥"`; 3 `remove n` + `aura b off` + `counter t "1"`.

  ```ts
  it('zoneCells: rombo Manhattan recortado al tablero', () => {
    expect(zoneCells({ kind: 'explosion', center: { x: 0, y: 0 }, radius: 1 }, { w: 9, h: 9 }))
      .toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]));
    expect(zoneCells({ kind: 'explosion', center: { x: 0, y: 0 }, radius: 1 }, { w: 9, h: 9 })).toHaveLength(3);
    expect(zoneCells({ kind: 'explosion', center: { x: 4, y: 4 }, radius: 2 }, { w: 9, h: 9 })).toHaveLength(13);
    expect(zoneCells({ kind: 'glyph', cells: [{ x: 1, y: 1 }, { x: 20, y: 1 }] }, { w: 9, h: 9 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('boardAt(0) es la situación inicial', () => { const s = boardAt(room, 0); expect(s.pieces.find(p => p.id === 'b')!.invulnerable).toBe(true); expect(s.zones).toEqual([]); });
  it('boardAt aplica los cambios acumulados', () => { expect(boardAt(room, 1).pieces.find(p => p.id === 'b')!.cell).toEqual({ x: 4, y: 2 }); expect(boardAt(room, 1).actor).toBe('c'); });
  it('las zonas solo duran su paso', () => { expect(boardAt(room, 2).zones[0].cells).toHaveLength(12); expect(boardAt(room, 3).zones).toEqual([]); });
  it('remove, aura y counter', () => { const s = boardAt(room, 3); expect(s.pieces.map(p => p.id)).toEqual(['b', 'c']); expect(s.pieces[0].invulnerable).toBe(false); expect(s.counters).toEqual([{ id: 't', name: expect.anything(), value: '1' }]); });
  it('el paso se acota', () => { expect(boardAt(room, 99)).toEqual(boardAt(room, 3)); expect(boardAt(room, -1)).toEqual(boardAt(room, 0)); });
  it('move con path pinta la zona path', () => { /* sala con move path [{4,4}] → zones[0] = { kind: 'path', cells: [{4,4}] } */ });
  it('tiles persisten y null las limpia', () => { /* tiles red en (0,0) en paso 1, null en paso 2 → tiles['0,0'] 'red' en 1, undefined en 2 */ });
  it('no muta la sala', () => { const copy = structuredClone(room); boardAt(room, 3); expect(room).toEqual(copy); });
  ```
  Centro (4,1) radio 2 en 9×9: el rombo tiene 13 casillas y la de (4,-1) queda fuera → 12.

- [ ] **Step 2: Ejecutar** `npx vitest run src/lib/dungeons/play.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementar** `types.ts` y `play.ts` como en Interfaces. `boardAt` clona las piezas iniciales (no mutar `room`), recorre `steps[0..step]` aplicando cambios en orden; `zones` se vacía al empezar cada paso; `actor` y `text` son los del paso `step`.
- [ ] **Step 4: Ejecutar** `npx vitest run src/lib/dungeons/play.test.ts` → PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/dungeons/types.ts src/lib/dungeons/play.ts src/lib/dungeons/play.test.ts docs/superpowers/specs/2026-11-11-mazmorras-invulnerabilidad-design.md docs/superpowers/plans/2026-11-11-mazmorras-invulnerabilidad.md
  git commit -m "Mazmorras: tipos y estado del tablero por paso"
  ```

### Task 2: Validador de archivos de mazmorra

**Files:**
- Create: `src/lib/dungeons/validate.ts`
- Test: `src/lib/dungeons/validate.test.ts`

**Interfaces:**
- Consumes: tipos de Task 1, `boardAt`.
- Produces: `export function checkDungeon(d: Dungeon): string[]` — lista de errores vacía si todo está bien. Cada mensaje empieza por `"<dungeon.id>/<room.id>"` y, si aplica, `" paso <i>"`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Una mazmorra válida mínima (1 sala, 2 pasos) → `[]`. Y una prueba por regla, cada una rompiendo solo esa regla y comprobando `toContainEqual(expect.stringContaining(...))`:
  - `L10n` con algún idioma vacío o ausente (en `name` de mazmorra, sala, pieza, `role`, `condition`, `duration`, `text`, `counter.name`) → `"falta traducción"`.
  - `tier` con min > max o fuera de 1-230 → `"tramo"`.
  - `guide` que no empieza por `https://` → `"guía"`.
  - sala sin pasos, o paso 0 con cambios → `"paso 0"`.
  - ids de pieza repetidos (iniciales o `add`) → `"id repetido"`.
  - casilla fuera de `size` (pieza, `move.to`, `path`, `tiles`, `zone.cells`, `zone.center`) → `"fuera del tablero"`.
  - cambio o `actor` que apunta a una pieza inexistente o ya quitada → `"pieza desconocida"`.
  - dos piezas en la misma casilla tras un paso → `"misma casilla"`.
  - `rooms` vacío → `"sin salas"`.
- [ ] **Step 2: Ejecutar** `npx vitest run src/lib/dungeons/validate.test.ts` → FAIL.
- [ ] **Step 3: Implementar `checkDungeon`.** Recorre pasos llevando el conjunto de piezas vivas (igual que `boardAt`) para las reglas de "pieza desconocida" y "misma casilla".
- [ ] **Step 4: Ejecutar** → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mazmorras: validador de los archivos de cada mazmorra"`.

### Task 3: Registro y primera mazmorra (Tropikes)

**Files:**
- Create: `src/lib/dungeons/index.ts`
- Create: `src/lib/dungeons/data/tropikes.ts`
- Test: `src/lib/dungeons/dungeons.test.ts`

**Interfaces:**
- Consumes: `checkDungeon`, tipos.
- Produces (`index.ts`):
  ```ts
  export const DUNGEONS: Dungeon[];            // orden: por tier[0], luego por name.fr
  export const EXCLUDED: Excluded[];
  export function byTier(list?: Dungeon[]): { tier: [number, number]; dungeons: Dungeon[] }[];  // tramos ascendentes
  ```
- Cada archivo de datos: `const d: Dungeon = {...}; export default d;`

- [ ] **Step 1: Escribir la prueba** en `dungeons.test.ts`:
  ```ts
  it.each(DUNGEONS.map(d => [d.id, d]))('%s es coherente', (_, d) => expect(checkDungeon(d)).toEqual([]));
  it('ids únicos', () => expect(new Set(DUNGEONS.map(d => d.id)).size).toBe(DUNGEONS.length));
  it('una mazmorra no está a la vez incluida y excluida', () => { const ids = new Set(DUNGEONS.map(d => d.id)); expect(EXCLUDED.filter(e => ids.has(e.id))).toEqual([]); });
  it('byTier agrupa y ordena', () => { const g = byTier(); expect(g.map(x => x.tier[0])).toEqual([...g.map(x => x.tier[0])].sort((a, b) => a - b)); });
  it('Tropikes tiene sala 1 y boss', () => expect(DUNGEONS.find(d => d.id === 'tropikes')!.rooms.map(r => r.id)).toEqual(['room1', 'boss']));
  ```
- [ ] **Step 2: Ejecutar** `npx vitest run src/lib/dungeons/dungeons.test.ts` → FAIL.
- [ ] **Step 3: Escribir `index.ts`** y `tropikes.ts` siguiendo el Procedimiento de contenido. Tropikes: tramo `[171, 185]`, guía `https://wakfu.guide/donjons/171-185/`. Sala 1: 3 monstruos con aura verde invulnerables hasta que les alcance la explosión de una Nodkoko (las Nodkokos pierden 1 PV al final del turno, avanzan 2 casillas al inicio de turno, explotan a 0 PV en radio 2; se orientan golpeándolas desde el ángulo deseado). Boss Koko le Nutt: invulnerable hasta que le alcanza una explosión de Nodkoko; dura **1 turno**; solo se mueve con empujes y atracciones. Posiciones según las imágenes d73-d76.
- [ ] **Step 4: Ejecutar** `npx vitest run src/lib/dungeons` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mazmorras: registro y Donjon des Tropikes"`.

### Task 4: Interfaz — tablero, panel, sección e idiomas

**Files:**
- Create: `src/DungeonBoard.tsx`
- Create: `src/DungeonPanel.tsx`
- Modify: `src/App.tsx:71` (tipo de `section`), `src/App.tsx:282` (lista de secciones), junto a `src/App.tsx:289-291` (montar el panel)
- Modify: `src/locales/es.ts`, `src/locales/en.ts`, `src/locales/fr.ts`
- Modify: `src/styles.css` (bloque nuevo `.dun-*` al final)
- Test: `src/DungeonPanel.test.tsx`

**Interfaces:**
- Consumes: `DUNGEONS`, `byTier`, `boardAt`, `zoneCells` no (ya vienen expandidas en `BoardState`), `t`, `useLang`.
- Produces:
  ```ts
  // DungeonBoard.tsx
  export default function DungeonBoard(props: { state: BoardState; size: { w: number; h: number }; roomName: string }): JSX.Element;
  // DungeonPanel.tsx
  export default function DungeonPanel(props: { active: boolean }): JSX.Element;
  export const PLAY_MS = 1800;
  export function playFrom(step: number, total: number): number;      // último paso → 0; si no, el mismo
  export function autoNext(step: number, total: number): { step: number; playing: boolean };  // avanza; al llegar al último, playing=false
  export function selectionReset(): { step: 0; playing: false };
  ```

**Claves de idioma** (texto español exacto; en/fr traducidos por el implementador):

| clave | es |
|---|---|
| `section.dungeons` | Mazmorras |
| `dun.aria` | Guía de mazmorras |
| `dun.pick` | Mazmorra |
| `dun.tier` | Nivel {min}-{max} |
| `dun.room` | Sala |
| `dun.board` | Tablero: {room} |
| `dun.cell` | Casilla {x}, {y} |
| `dun.piece` | {name}, casilla {x}, {y} |
| `dun.invulnerable` | invulnerable |
| `dun.step` | Paso {n} / {total} |
| `dun.first` | Volver al inicio |
| `dun.prev` | Paso anterior |
| `dun.next` | Paso siguiente |
| `dun.play` | Reproducir |
| `dun.pause` | Pausa |
| `dun.condition` | Cómo se quita |
| `dun.duration` | Duración |
| `dun.guide` | Guía original |
| `dun.unverified` | Mecánicas y posiciones tomadas de guías de la comunidad; no comprobadas en el juego. |
| `dun.legend.boss` | Boss |
| `dun.legend.mob` | Monstruo |
| `dun.legend.special` | Pieza de la mecánica |
| `dun.legend.char` | Personaje |
| `dun.legend.inv` | Aura = invulnerable |

**Pantalla:** arriba `<select>` con `<optgroup label={t('dun.tier', …)}>` por tramo (nombre en el idioma actual) y, si hay más de una sala, botones de sala con `role="tab"`. Debajo, el tablero y la leyenda; luego controles (⏮ ◀ ▶/⏸ ▶, cada uno con `aria-label` de las claves), `dun.step`, la frase del paso (`aria-live="polite"`), contadores, "Cómo se quita"/"Duración" de la sala, enlace a la guía (`target="_blank" rel="noopener"`) y el aviso.

**Tablero:** contenedor con `aspect-ratio: w / h` y ancho 100 % (máx. ~520px); casillas en CSS grid; piezas en una capa absoluta con `left/top` en % (`x / w * 100`) y `transition: left .5s, top .5s` desactivada bajo `@media (prefers-reduced-motion: reduce)`. Pieza = círculo por tipo (boss mayor; colores de la paleta de la app) con la inicial o `label` dentro, aura con `box-shadow` verde si `invulnerable`, contorno de resalte si `id === state.actor`, `title` y `aria-label` = `dun.piece` (+ `dun.invulnerable`). Zonas y `tiles` como clases de casilla (`.dun-zone-explosion`, `.dun-tile-red`, …). Sin scroll horizontal a 375px.

- [ ] **Step 1: Escribir las pruebas que fallan** en `DungeonPanel.test.tsx` (mismo patrón que `SimPanel.test.tsx`: `vi.stubGlobal('document', { documentElement: {} })`, `setLang('es')`, `renderToString`):
  ```ts
  it('playFrom reinicia en el último paso', () => { expect(playFrom(3, 4)).toBe(0); expect(playFrom(1, 4)).toBe(1); });
  it('autoNext se para al final', () => { expect(autoNext(1, 4)).toEqual({ step: 2, playing: true }); expect(autoNext(2, 4)).toEqual({ step: 3, playing: false }); });
  it('selectionReset', () => expect(selectionReset()).toEqual({ step: 0, playing: false }));
  it('monta con la primera mazmorra, paso 1 / n y aviso', () => { const h = renderToString(<DungeonPanel active />); expect(h).toContain('Paso 1 /'); expect(h).toContain('no comprobadas en el juego'); expect(h).toContain(DUNGEONS[0].guide); });
  it('nombres en el idioma elegido', () => { setLang('fr'); const h = renderToString(<DungeonPanel active />); expect(h).toContain(DUNGEONS[0].rooms[0].pieces[0].name.fr); setLang('es'); });
  it('el tablero marca invulnerable y actor', () => { const room = DUNGEONS[0].rooms[0]; const h = renderToString(<DungeonBoard state={boardAt(room, 0)} size={room.size} roomName="x" />); expect(h).toContain('invulnerable'); });
  it('los tres idiomas tienen las mismas claves', () => { expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort()); expect(Object.keys(fr).sort()).toEqual(Object.keys(es).sort()); });
  ```
- [ ] **Step 2: Ejecutar** `npx vitest run src/DungeonPanel.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** `DungeonBoard`, `DungeonPanel`, claves y estilos. Estado del panel: `dungeonId`, `roomId`, `step`, `playing`. Cambiar mazmorra o sala aplica `selectionReset()`. Un `useEffect` con `setInterval(PLAY_MS)` solo mientras `active && playing`, usando `autoNext`; se limpia al cambiar cualquiera de los dos. "Reproducir" hace `setStep(playFrom(step, total)); setPlaying(true)`. Usar `useLang()` para re-renderizar al cambiar de idioma y `l10n[lang]` para los textos de datos.
- [ ] **Step 4: Integrar en `App.tsx`:** `useState<'builds' | 'teams' | 'dungeons'>`, añadir `'dungeons'` a la lista de pestañas y `<div hidden={section !== 'dungeons'}><DungeonPanel active={section === 'dungeons'} /></div>`.
- [ ] **Step 5: Ejecutar** `npm test` → PASS todo; `npm run build` → sin errores de tipos.
- [ ] **Step 6: Comprobar en el navegador** con `npm run dev`: abrir Mazmorras → Tropikes, reproducir las dos salas, cambiar de idioma a mitad, cambiar de sala con la reproducción en marcha, y ver el ancho a 375px sin scroll horizontal.
- [ ] **Step 7: Commit** `git commit -m "Mazmorras: sección con tablero animado por sala"`.

### Tasks 5-10: Contenido por tramos

Cada task sigue el Procedimiento de contenido para su lista, añade los archivos a `DUNGEONS` (o a `EXCLUDED`), ejecuta `npx vitest run src/lib/dungeons` → PASS y hace un commit `"Mazmorras: tramo <tramo>"`. Los ids son el nombre en minúsculas sin artículos ni acentos, con guiones. Lo que hay que mostrar en cada una (de la revisión del 2026-11-11; confirmar con la guía):

**Task 5 — 36-50** (`/donjons/36-50/`)
- `poulpe` Equipage du Poulpe: boss invulnerable bajo el agua; matar los 4 tentáculos que invoca → vuelve a la superficie.
- `tour-minerale` Tour Minérale: barreras del patrón 2 bloquean la línea de visión → romper las piedras del mismo color; +300 res. del boss hacia el turno 3 → destruir los 4 cristales elementales.

**Task 6 — 66-95** (`/donjons/66-80/`, `/donjons/81-95/`)
- `corbeau-cave` Corbeau-Cave: los monstruos reflejan cada 6.º golpe (aura morada) → cura o boost sobre el reflejo.
- `excarnus` Excarnus: tótems → daño a distancia = 0 y "terre maudite" da +300 res. → golpear tótems en melé o a ≤ 3 PO, primero "terre maudite".
- `truchiere` Truchière Abandonnée: boss invulnerable con huevos vivos → placar al boss y matar todos los huevos en 2 turnos.
- `scarriere` Scarrière Abandonnée: 99 % res. → el personaje que juega tras el boss mata el escarabajo del elemento del equipo; cada escarabajo cura al boss un 25 %.
- `slekymoses` Caverne des Slekymoses: glifo blanco (se mueve cada turno) → pasar turno → Slek → hechizo melé de 4 PA sobre el boss; "Manger des cailloux" para volver.

**Task 7 — 96-125** (`/donjons/96-110/`, `/donjons/111-125/`)
- `magik-riktus`: golpe por la espalda invoca sombrero (1 por personaje y turno); con 3, vulnerable; matar un sombrero lo vuelve invulnerable → matar boss antes. Contador "sombreros n/3".
- `arene-dansante`: refleja salvo desde la PO igual al estado de arritmia (1-7). Contador "arritmia".
- `corbeau-noir` Antre du Corbeau Noir: fase 1 invulnerable → matar un corbac → hechizo especial (barra 3, 4 PO) sobre el boss; 1 turno.
- `hagen-glass` Pot d'Hagen-Glass: armadura de hielo +250 res. → quitar PA con choques o empujes.
- `smarrante` Caverne Smarrante: golpe melé → vulnerable durante el turno de ese personaje.
- `cacterre`: 10 PA de daño de cada elemento. Contador por elemento.
- `dragon-cochon` Antre du Dragon-Cochon: fase 1 → 30 PA por la espalda (estado "mal-o-derrière"), contador; a 70 % y 30 % → frenesí 7 con 7 acciones distintas en un turno, luego atacar en su turno.

**Task 8 — 126-155** (`/donjons/126-140/`, `/donjons/141-155/`)
- `noirespore`: sala 1 → Sepolourpode invulnerables mientras vivan los demás; boss fase 1 → matar su invocación (≤ 3 PO del boss); fase 2 → esperar 2 turnos.
- `potofeu` Compost du grand Potofeu: fase 2 (50 %) → pasar el veneno de la Aubergine al boss en melé, luego atacar; dos veces.
- `jawdin` Jawdin de la Weine: boss en la explosión (3 PO) de una Cawotte a 1 PV → 1 turno.
- `source-du-mal`: estado "Mort Subite" → matar Bulbiflore, boss en el glifo azul oscuro.
- `wa-wabbit` Château du Wa Wabbit: invulnerable hasta que mueran los 4; el Wobot muere normal, los 3 Wabbits necesitan el logo dorado (el boss da uno por turno).
- `enutrosor`: +400 res. bajan al dañar el diamante blanco; matar una de las 4 gemas → daño ×5 un turno; en el boss, no pegar con un aliado en su melé.

**Task 9 — 156-170** (`/donjons/156-170/`)
- `lampionaute`: cada atacante empieza turno a ≤ 2 casillas del dial central ("Foudroyé") y hace un movimiento inverso que acaba en melé de Javého → vulnerable para ese personaje 1 turno.
- `roub-bar`: sala 1 → +300 res., muros de pólvora −400; boss Remington → "Bombifié" en aliados, línea de pólvora entre ellos, forzarlo en la estela; fase 2 en la niebla cada 2 turnos.
- `e-bou`: fase 1 → pisar las casillas azules del borde hasta rojas (lanzar desde roja la vuelve azul); fase 3 → resetear las rojas y sacar al boss del cuadrado central.
- `fabrique-meka`: sala 1 y boss Vertox → empezar el turno en el glifo central azul oscuro (+50 % daño ese turno).

**Task 10 — 171-185** (`/donjons/171-185/`)
- `crocodailles`: sala 1 → 3 monstruos +500 res. hasta una colisión (aura verde); todo movimiento desliza 3 casillas más en la dirección de la mirada; boss Roi Dunil → invulnerable desde el 55 %, colisión para volver a dañarlo; no se puede mover salvo por la colisión.
- `gerbouille`: Conducteur (la "morsure" del boss a 1-4 casillas); 8 burbujas electrostáticas al final de cada turno; golpe melé desde las dos casillas del diagrama d121 en el mismo turno → quita invulnerabilidad y estabilización, le da 2 PW.

Kannibouls, Cité Interdite y Kannivores ya se saben poco claras: añadirlas a `EXCLUDED` en Task 10 con su motivo, salvo que la revisión completa diga lo contrario.

### Task 11: Repaso final

- [ ] **Step 1:** `npm test` y `npm run build` → PASS.
- [ ] **Step 2:** En el navegador, recorrer cada mazmorra en es, en y fr: nada en inglés dentro de la vista en español salvo nombres marcados `// nombre pendiente`.
- [ ] **Step 3:** Listar en el mensaje final las mazmorras de `EXCLUDED` con su motivo y los nombres pendientes.
