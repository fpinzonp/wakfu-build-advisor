# Simulador de daño y apoyo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la vista de build una pestaña "Simulador" que calcula daño, curas y armadura de una secuencia de hechizos y movimientos contra un mob, con un aliado opcional.

**Architecture:** El cálculo son funciones puras en `src/lib/sim/`, sin React: `simulate(input)` recorre los pasos y devuelve el resultado de cada uno. Las reglas de Yopuka y Sacrogrito son módulos enchufados al motor. Los datos de hechizos y mobs se generan en `scripts/build-data.mjs` desde wakfu.wiki.gg.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Vitest (nuevo), Node para los scripts de datos.

**Spec:** `docs/superpowers/specs/2026-11-06-simulador-dano-design.md`

## Global Constraints

- Todo texto visible usa `t()`, con claves en `src/locales/es.ts`, `en.ts` y `fr.ts`.
- Comentarios del código en español, como en el resto del proyecto.
- Sin dependencias de ejecución nuevas. Vitest solo como `devDependency`.
- La wiki se descarga una sola vez y se guarda en `data/wiki-cache.json`. Sin `--refresh-wiki` no se vuelve a pedir.
- Cabecera `User-Agent` de siempre: `wikiHeaders`.
- Mapa de 11×11. Melé a 1-2 casillas, distancia a 3 o más.
- Berserker: PV estrictamente por debajo del 50 %.
- Posición: ×1 de frente, ×1,1 de lado, ×1,25 por la espalda.
- En móvil, las columnas se apilan y no hay scroll horizontal.
- Lo que no se calcula se avisa en su fila; nunca se omite en silencio.

## Review Focus

1. Secuencia hecha, y luego la build cambia con menos PA o quita un hechizo: el paso queda marcado como no válido, con su motivo, y no se borra ni suma al total.
2. Mob sin ficha completa en la wiki: se excluye de la lista o sus datos quedan editables. Nunca cae a `undefined` ni produce `NaN`.
3. Hechizo sin datos de coste o con efectos que no se pudieron leer: su fila avisa "sin calcular" y no cuenta como 0 de daño correcto.
4. Build guardada que ya no se puede abrir como aliado (código roto o sin objetos válidos): mensaje de error con salida y el modo normal sigue funcionando.
5. Baraja vacía o sin hechizos activos: el simulador dice qué hacer y lleva a la pestaña Hechizos.

---

### Task 1: Pruebas y fórmulas

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `src/lib/sim/formulas.ts`, `src/lib/sim/formulas.test.ts`

**Interfaces:**
- Produces, en `formulas.ts`:
  - `type Position = 'front' | 'side' | 'back'`, `type Facing = 'n' | 'e' | 's' | 'w'`, `interface Cell { x: number; y: number }`
  - `distance(a: Cell, b: Cell): number` (Manhattan)
  - `isMelee(a: Cell, b: Cell): boolean`
  - `positionOf(attacker: Cell, target: Cell, facing: Facing): Position`
  - `isBerserk(hpPct: number): boolean`
  - `baseAtLevel(min: number, max: number, level: number): number`
  - `damageValue(i: { base: number; mastery: number; position: Position; dmgPct: number; resPct: number }): number`
  - `healValue(i: { base: number; mastery: number; healDone: number; healReceived: number; healRes: number; incurable: number }): number`
  - `armorValue(i: { base: number; armorGiven: number; armorReceived: number; crumbly: number; onSelf: boolean }): number`
  - `addArmor(current: number, gain: number, maxHp: number): number`
  - `addHealRes(current: number, healed: number, maxHp: number): number`

- [ ] **Step 1: Instalar Vitest y preparar el proyecto**

Run: `npm i -D vitest`
Añadir el script `"test": "vitest run"` a `package.json` y la línea `.superpowers/` a `.gitignore`.

- [ ] **Step 2: Escribir las pruebas que fallan en `src/lib/sim/formulas.test.ts`**

```ts
const hit = { base: 100, mastery: 500, dmgPct: 10, resPct: 20 };
expect(damageValue({ ...hit, position: 'front' })).toBe(528);
expect(damageValue({ ...hit, position: 'side' })).toBe(580);
expect(damageValue({ ...hit, position: 'back' })).toBe(660);
expect(healValue({ base: 100, mastery: 400, healDone: 20, healReceived: 10, healRes: 5, incurable: 0 })).toBe(617);
expect(armorValue({ base: 100, armorGiven: 20, armorReceived: 10, crumbly: 0, onSelf: false })).toBe(130);
expect(armorValue({ base: 100, armorGiven: 20, armorReceived: 10, crumbly: 0, onSelf: true })).toBe(110);
expect(addArmor(900, 300, 2000)).toBe(1000);
expect(addHealRes(0, 500, 2000)).toBe(5);
const t = { x: 6, y: 5 };
expect(positionOf({ x: 7, y: 5 }, t, 'e')).toBe('front');
expect(positionOf({ x: 5, y: 5 }, t, 'e')).toBe('back');
expect(positionOf({ x: 6, y: 4 }, t, 'e')).toBe('side');
expect(positionOf({ x: 7, y: 4 }, t, 'e')).toBe('side');
expect(positionOf({ x: 8, y: 6 }, t, 'e')).toBe('front');
expect(isMelee({ x: 3, y: 5 }, { x: 5, y: 5 })).toBe(true);
expect(isMelee({ x: 3, y: 5 }, { x: 6, y: 5 })).toBe(false);
expect(isBerserk(49.9)).toBe(true);
expect(isBerserk(50)).toBe(false);
expect(baseAtLevel(2, 60, 1)).toBe(2);
expect(baseAtLevel(2, 60, SPELL_MAX_LEVEL)).toBe(60);
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/formulas.test.ts`
Expected: FAIL, no se encuentra `./formulas`.

- [ ] **Step 4: Implementar `formulas.ts`**

Usar las fórmulas del spec y `Math.floor(x + 1e-9)` para el resultado, para que el error de coma flotante no reste 1. `positionOf`: gana el eje con mayor distancia; un empate cuenta como lado. Reutilizar `resistancePct` en el motor, no aquí. Exportar `SPELL_MAX_LEVEL = 245`, con un comentario que diga que falta validarlo con un golpe real; `baseAtLevel` interpola de forma lineal y redondea hacia abajo.

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/formulas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore src/lib/sim
git commit -m "Simulador: fórmulas de daño, cura y armadura con pruebas"
```

### Task 2: Datos de hechizos y mobs

**Files:**
- Create: `scripts/wiki-parse.mjs`, `scripts/wiki-parse.test.mjs`
- Modify: `scripts/build-data.mjs:231-345`, `src/lib/spells.ts`, `.gitignore` si `public/data` lo requiere
- Generated: `public/data/spells.json`, `public/data/mobs.json`

**Interfaces:**
- Produces, en `src/lib/spells.ts`:

```ts
export interface SpellLine { kind: 'damage' | 'heal' | 'armor'; min: number; max: number; critMin: number; critMax: number }
export interface SpellCast {
  key: string;                 // nombre inglés de la wiki: identificador estable
  ap: number; mp: number; wp: number;
  rangeMin: number; rangeMax: number; rangeMod: boolean; los: boolean;
  perTurn: number | null; target: 'st' | 'aoe';
  lines: SpellLine[]; berserkLines?: SpellLine[];
  stateGains: { state: number; levels: number }[];  // de "{{st|id}} (+N Lvl.)"
  partial: boolean;            // quedaron efectos sin interpretar
}
// Spell gana: cast?: SpellCast
```

- Produces, `public/data/mobs.json`: `{ version: string; mobs: Mob[] }`, y en `src/lib/sim/mobs.ts`:

```ts
export interface Mob { name: string; family: string; type: string; minLevel: number; maxLevel: number;
  hp: [number, number]; ap: number; mp: number;
  res: Record<Element, [number, number]> }
export const mobAtLevel = (m: Mob, level: number) => /* interpolado: hp y res numéricos */
```

- Produces, en `scripts/wiki-parse.mjs`: `parseInfobox(wikitext: string, template: string): Record<string, string>`, `parseRange(v: string): [number, number]`, `parseSpellCast(fields: Record<string, string>, row: { spell: string; ap: number; mp: number; wp: number }): SpellCast`, `parseMob(wikitext: string): Mob | null`.

- [ ] **Step 1: Escribir las pruebas que fallan en `scripts/wiki-parse.test.mjs`**

Usar como fixtures los textos reales de `Burning Arrow`, `Jabs` y `Blue Raspberry Jelly (monster)`:

```js
expect(parseRange('2350 to 2450')).toEqual([2350, 2450]);
expect(parseRange('10')).toEqual([10, 10]);
const jabs = parseSpellCast(parseInfobox(JABS, 'Spell'), { spell: 'Jabs', ap: 3, mp: 0, wp: 0 });
expect(jabs).toMatchObject({ key: 'Jabs', ap: 3, rangeMin: 1, rangeMax: 1, los: true, perTurn: 2, target: 'st', partial: false });
expect(jabs.lines).toEqual([{ kind: 'damage', min: 3, max: 105, critMin: 4, critMax: 132 }]);
expect(jabs.stateGains).toEqual([{ state: 3442, levels: 25 }]);
const arrow = parseSpellCast(parseInfobox(ARROW, 'Spell'), { spell: 'Burning Arrow', ap: 2, mp: 0, wp: 0 });
expect(arrow).toMatchObject({ rangeMin: 2, rangeMax: 5, rangeMod: true, target: 'aoe', perTurn: 3 });
expect(arrow.partial).toBe(true);   // "on summons" no se interpreta
expect(parseMob(JELLY)).toMatchObject({ hp: [2350, 2450], ap: 10, mp: 4, res: { water: [287, 299], earth: [52, 64], air: [169, 181], fire: [169, 181] } });
expect(parseMob('{{Infobox monster|title=X}}')).toBeNull();   // sin PV ni resistencias
```

La última línea cubre el punto 2 de Review Focus.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run scripts/wiki-parse.test.mjs`
Expected: FAIL, no se encuentra `./wiki-parse.mjs`.

- [ ] **Step 3: Implementar `scripts/wiki-parse.mjs`**

Una línea de efecto solo cuenta en `lines` si es `Damage: A-B`, `Heals: A-B` o `Armor` con rango, sin más condiciones. El resto de líneas numéricas marca `partial`. Las líneas tras `Effects if Berserk` van a `berserkLines`.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run scripts/wiki-parse.test.mjs`
Expected: PASS.

- [ ] **Step 5: Comprobar las maestrías de un objetivo y de zona**

Buscar en los datos de objetos de Ankama que usa `build-data.mjs` los `actionId` 1050 y 1051, y confirmar sus nombres en `actions`. Si algún objeto actual los usa, añadirlos a `ACTIONS` como `mastSingle` y `mastArea`, y sumar `mastSingle` a un hechizo `target: 'st'` y `mastArea` a uno `'aoe'` en la Task 3. Si no, dejar constancia en el mensaje del commit.

- [ ] **Step 6: Ampliar `build-data.mjs`**

Añadir `fetchSpellPages()` y `fetchMobs()` a `fetchWiki()`, con la misma comprobación de "copias antiguas" del archivo. Pedir el wikitext con `action=query&prop=revisions&rvprop=content&rvslots=main`, en lotes de 50 títulos. Lista de mobs: tabla Cargo `Monsters` (1354 filas en noviembre de 2026), excluyendo los `parseMob` nulos. Añadir `ap`, `mp`, `wp` a los campos de `fetchSpells`.

- [ ] **Step 7: Generar los datos y comprobarlos**

Run: `npm run data -- --refresh-wiki`
Expected: el log informa de los mobs guardados y los descartados. `public/data/mobs.json` existe y contiene `Blue Raspberry Jelly`. Al menos 400 de los hechizos activos tienen `cast`.

- [ ] **Step 8: Commit**

```bash
git add scripts src/lib/spells.ts src/lib/sim/mobs.ts data/wiki-cache.json public/data
git commit -m "Datos: costes y efectos de hechizos, y fichas de mobs"
```

### Task 3: Motor de la simulación

**Files:**
- Create: `src/lib/sim/engine.ts`, `src/lib/sim/engine.test.ts`

**Interfaces:**
- Consumes: Task 1 y `Spell`, `SpellCast` de Task 2; `resistancePct` de `src/lib/characteristics.ts`.
- Produces:

```ts
export type ActorId = 'main' | 'ally';
export interface SimActor { id: ActorId; name: string; classId: string; level: number;
  stats: Record<string, number>; mastery: Record<Element, number>; maxHp: number;
  ap: number; mp: number; wp: number; spells: Spell[]; start: Cell }
export interface SimTarget { name: string; hp: number; res: Record<Element, number>;
  resBack: number; resCrit: number; cell: Cell; facing: Facing }
export type SimStep =
  | { type: 'cast'; actor: ActorId; spell: number; target: 'mob' | 'ally' | 'self' }
  | { type: 'move'; actor: ActorId; to: Cell }
  | { type: 'endTurn' }
  | { type: 'adjust'; actor?: ActorId; hpPct?: number; armor?: number; facing?: Facing };
export interface Triple { normal: number; crit: number; avg: number }
export interface StepRow { kind: 'damage' | 'heal' | 'armor'; value: Triple; raw?: Triple;
  position?: Position; tags: TKey[]; warnings: TKey[] }
export interface ActorState { cell: Cell; ap: number; mp: number; wp: number; hp: number; armor: number;
  healRes: number; states: Record<string, number>; uses: Record<number, number> }
export interface SimState { actors: Partial<Record<ActorId, ActorState>>; mobHp: number; facing: Facing; turn: number }
export interface StepResult { step: SimStep; ok: boolean; reason?: TKey; rows: StepRow[]; state: SimState }
export interface SimInput { actors: SimActor[]; target: SimTarget; steps: SimStep[]; comboExtraPct: number }
export interface SimResult { steps: StepResult[];
  totals: Partial<Record<ActorId, Record<'damage' | 'heal' | 'armor', Triple>>> }
export function simulate(input: SimInput): SimResult;
export interface CastMods { dmgPct?: number; tags?: TKey[]; warnings?: TKey[]; lines?: SpellLine[] }
export interface ClassRules {
  beforeCast?(state: ActorState, actor: SimActor, spell: Spell, input: SimInput): CastMods;
  afterCast?(state: ActorState, actor: SimActor, spell: Spell): void;
  onEndTurn?(state: ActorState): void;
}
export const CLASS_RULES: Partial<Record<string, ClassRules>>;   // vacío en esta tarea
```

- [ ] **Step 1: Escribir las pruebas que fallan en `engine.test.ts`**

Crear un helper `fixture()` con un personaje de nivel 245, 6 PA, 4 PM, 6 PW, `mastery.air = 500`, `mastMelee = 100`, `mastBack = 200`, `mastCrit = 100`, `dmgPct = 0`, `crit = 20`, y un objetivo con resistencia de aire 0 en (6,5) mirando al oeste, y personaje en (5,5). Hechizo: `Jabs` con `ap: 3`, `perTurn: 2`, base de nivel máximo 105 y crítica 132.

```ts
it('calcula un golpe de frente', ...)     // normal = 105 × 7 = 735; crit = 132 × 8 = 1056; avg = 735 × 0,8 + 1056 × 0,2 = 799
it('sube el daño por la espalda', ...)    // con mob mirando al este: normal = 105 × 9 × 1,25 = 1181
it('no permite gastar más PA de los que hay', ...)  // tercer Jabs: ok false, reason 'sim.err.ap', no cuenta en totals
it('respeta usos por turno', ...)         // 8 PA: tercer Jabs, reason 'sim.err.uses'
it('respeta el alcance', ...)             // personaje a 3 casillas, reason 'sim.err.range'
it('fin de turno recupera recursos', ...)
it('mover gasta PM y actualiza la posición', ...)
it('no se puede mover a una casilla ocupada o fuera del mapa', ...)
it('marca sin borrar los pasos que dejan de ser válidos', ...)   // Review Focus 1: ap baja a 2, ok false, los demás pasos siguen y totals no lo cuenta
it('avisa cuando el hechizo es parcial o no tiene cast', ...)    // Review Focus 3: warnings ['sim.warn.partial'] o ['sim.warn.noData']
it('devuelve estado inmutable por paso', ...)
it('limita la cura a los PV que faltan y conserva el bruto', ...)
it('topa la armadura al 50 % de PV máximos', ...)
it('aplica % armadura dada solo a aliados', ...)
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/engine.test.ts`
Expected: FAIL, no se encuentra `./engine`.

- [ ] **Step 3: Implementar `simulate`**

Un paso no válido deja el estado sin cambios y la secuencia continúa. El elemento `light` usa la maestría más alta, en el orden fuego, agua, tierra, aire; `neutral` sin línea de daño propia se avisa con `sim.warn.partial`. `avg` se calcula con el % de crítico limitado a 0-100. Sumar `mastBerserk` con `isBerserk`, y `mastBack` y `resBack` con posición `back`. Línea de visión siempre libre, porque el mapa no tiene obstáculos. Aplicar antes `CLASS_RULES[classId]?.beforeCast` y después `afterCast`.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sim
git commit -m "Simulador: motor de turnos con validación de recursos"
```

### Task 4: Reglas del Yopuka

**Files:**
- Create: `src/lib/sim/rules/iop.ts`, `src/lib/sim/rules/iop.test.ts`
- Modify: `src/lib/sim/engine.ts` (registrar en `CLASS_RULES`)

**Interfaces:**
- Consumes: `ClassRules`, `CastMods` de Task 3.
- Produces: `export const iopRules: ClassRules`, `export const COMBOS`, `export function matchCombo(history: Cost[]): ComboId | null`, `type Cost = 'ap1' | 'ap2' | 'ap3' | 'mp1' | 'wp1'`. Registrado como `CLASS_RULES.yopuka`.

Valores exactos:

```ts
healSteal: ['mp1', 'ap3', 'ap3'],  push: ['ap1', 'ap1', 'ap2'],  prep: ['mp1', 'mp1', 'wp1'],
extra: ['ap2', 'ap1', 'mp1'],  ap: ['wp1', 'ap3', 'wp1', 'ap1']
```

- [ ] **Step 1: Escribir las pruebas que fallan en `iop.test.ts`**

```ts
expect(matchCombo(['ap2', 'ap1', 'mp1'])).toBe('extra');
expect(matchCombo(['ap3', 'ap2', 'ap1', 'mp1'])).toBe('extra');   // solo el final
expect(matchCombo(['ap1', 'ap2'])).toBeNull();
it('el combo suma 5 de Concentración', ...)
it('Disipación anula esa Concentración', ...)      // pasiva Dissipation equipada
it('a 100 de Concentración da 1 PW, 4 de Preparación y resta 100', ...)
it('la Preparación se gasta en el siguiente hechizo de daño', ...)  // 20 niveles: +20 % de daño una vez
it('el combo de preparación da 20 niveles', ...)
it('el combo de daño extra aplica comboExtraPct y etiqueta sin confirmar', ...) // tag 'sim.tag.unconfirmed'
it('un hechizo con dos tipos de coste no cuenta como paso', ...)
it('el historial se reinicia al terminar el turno', ...)
it('andar no cuenta como paso del combo', ...)
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/rules/iop.test.ts`
Expected: FAIL, no se encuentra `./iop`.

- [ ] **Step 3: Implementar `iop.ts`**

Sumar la Concentración desde `spell.cast.stateGains` con estado 3442. Efectos sobre el último hechizo: robo de vida (150 %), empuje (etiqueta, sin daño de colisión: `sim.warn.collision`), preparación (20), daño extra y PA (+2 PA). Los hechizos cuyo daño depende de estados (`Thunderbolt`, `Iop's Wrath`, `Judgment`) quedan con `sim.warn.partial`, salvo lo que ya calcule el motor. Preparación limitada a 60 niveles.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/rules/iop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sim
git commit -m "Simulador: combos, Concentración y Preparación del Yopuka"
```

### Task 5: Reglas del Sacrogrito

**Files:**
- Create: `src/lib/sim/rules/sacrier.ts`, `src/lib/sim/rules/sacrier.test.ts`
- Modify: `src/lib/sim/engine.ts`

**Interfaces:**
- Consumes: `ClassRules`, `CastMods`, `SpellCast.berserkLines`.
- Produces: `export const sacrierRules: ClassRules`, registrado como `CLASS_RULES.sacrogrito`. Tabla interna `SELF_COST: Record<string, { pctOf: 'max' | 'current'; pct: number; when: 'before' | 'after' }>`, indexada por `cast.key`.

- [ ] **Step 1: Escribir las pruebas que fallan en `sacrier.test.ts`**

```ts
it('suma maestría berserker por debajo del 50 %', ...)
it('no la suma con exactamente 50 %', ...)
it('usa berserkLines en berserker y cuesta 1 PW más', ...)     // Assault
it('el retorno de llama tras el golpe no da berserker a ese golpe', ...)  // Sacrier's Fist: 5 % max
it('el coste previo sí activa berserker en ese golpe', ...)     // when: 'before'
it('Punición deja los PV en 20 % antes del golpe', ...)
it('Rocky Foot y Smashes usan la línea según la armadura', ...)
it('Corazón de Sacrogrito suma melé y distancia en berserker', ...)
it('los PV no bajan de 1', ...)
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/rules/sacrier.test.ts`
Expected: FAIL, no se encuentra `./sacrier`.

- [ ] **Step 3: Implementar `sacrier.ts`**

Rellenar `SELF_COST` con los hechizos activos cuyo efecto indica "Flame Return" o fija los PV. Los valores se copian de `data/wiki-cache.json`. En `Punition`, el cambio de PV solo aplica si la Furia no está en 100. Sin Furia modelada, aplicarlo siempre y añadir `sim.warn.partial`. Sin aviso, el resto de pasivas que no cambian el daño.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/rules/sacrier.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sim
git commit -m "Simulador: berserker y coste de PV del Sacrogrito"
```

### Task 6: Pestaña del simulador

**Files:**
- Create: `src/SimPanel.tsx`, `src/lib/sim/fromBuild.ts`, `src/lib/sim/fromBuild.test.ts`
- Modify: `src/App.tsx:606-607,752,838`, `src/styles.css`, `src/locales/es.ts`, `en.ts`, `fr.ts`

**Interfaces:**
- Consumes: `simulate`, `mobAtLevel`, `buildSheet`, `fitDeck`.
- Produces:
  - `actorFromBuild(id: ActorId, result: BuildResult, opts: { classId: string; level: number; elements: Element[]; deck: Deck; spells: Spell[]; start: Cell; name: string }): SimActor`
  - `SimPanel` con props `{ result: BuildResult; classId: string; level: number; elements: Element[]; deck: Deck; spells: Spell[] | null; onGoToDeck: () => void }`

- [ ] **Step 1: Escribir las pruebas que fallan en `fromBuild.test.ts`**

```ts
it('toma PA, PM, PW, PV y maestrías de la ficha', ...)
it('solo incluye los hechizos activos de la baraja', ...)
it('con baraja vacía devuelve spells vacío', ...)   // Review Focus 5
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/fromBuild.test.ts`
Expected: FAIL, no se encuentra `./fromBuild`.

- [ ] **Step 3: Implementar `fromBuild.ts`**

Construirlo sobre `buildSheet` y `fitDeck`. El mapa de `mastery` sale de `sheet.elements`.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/fromBuild.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `SimPanel.tsx`**

Sigue el mockup B del spec:
- Izquierda: buscador de mob, con nivel y resistencias editables; mapa de 11×11 con personaje, mob, orientación y alcance; baraja.
- Derecha: recursos restantes, tabla de pasos con los avisos, total del turno y de la secuencia con los tres valores.
- Reproducción: inicio, anterior, siguiente, reproducir y en vivo, a 800 ms por paso.
- Controles: fin de turno, % de PV, girar el mob y % del combo de daño extra.
- `mobs.json` se carga al abrir la pestaña por primera vez, con `fetch(import.meta.env.BASE_URL + 'data/mobs.json')`.
- Con la baraja vacía, mostrar un estado vacío con botón que llama a `onGoToDeck`.

- [ ] **Step 6: Conectar la pestaña en `App.tsx`**

Añadir `'sim'` a `ViewTab` y `VIEW_TABS`, y un bloque `<div hidden={tab !== 'sim'} className="tab-body">` con `SimPanel`. La secuencia vive en el estado de `SimPanel`, que sigue montado porque las pestañas ocultas no se desmontan. Añadir `tab.sim` y todas las claves `sim.*` a los tres idiomas.

- [ ] **Step 7: Comprobar tipos y compilación**

Run: `npm test && npm run build`
Expected: todas las pruebas pasan y el build termina sin errores.

- [ ] **Step 8: Probar en el navegador**

Run: `npm run dev`
Comprobar con una build de Yopuka: añadir golpes, mover detrás del mob y ver subir el daño, reproducir, cambiar un objeto y ver recalcular. Repetir a 375 px de ancho.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "Simulador: pestaña con mapa, tabla de golpes y reproducción"
```

### Task 7: Modo de apoyo

**Files:**
- Create: `src/lib/sim/ally.ts`, `src/lib/sim/ally.test.ts`
- Modify: `src/App.tsx:137-148`, `src/SimPanel.tsx`, `src/locales/es.ts`, `en.ts`, `fr.ts`

**Interfaces:**
- Consumes: `decodeBuild`, `loadStored`, `evaluateBuild`, `actorFromBuild`.
- Produces: `resolveSaved(saved: SavedBuild, items: Item[], spellData: SpellData): { result: BuildResult; spells: Spell[] }`, sacado de `openSaved`, y `allyFromStored(stored: StoredBuild, items: Item[], spellData: SpellData): SimActor | null`. `SimPanel` recibe además `items: Item[]` y `spellData: SpellData | null`.

- [ ] **Step 1: Escribir las pruebas que fallan en `ally.test.ts`**

```ts
it('crea el aliado desde una build guardada', ...)
it('devuelve null con un código roto', ...)      // Review Focus 4
it('devuelve null si ningún objeto existe ya', ...)
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/lib/sim/ally.test.ts`
Expected: FAIL, no se encuentra `./ally`.

- [ ] **Step 3: Implementar `ally.ts` y extraer `resolveSaved`**

Sacar de `openSaved` (`App.tsx:137-148`) la parte que convierte una build guardada en resultado, junto con lo que necesite de `requestFor`, sin cambiar su comportamiento. `openSaved` pasa a llamarla.

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/lib/sim/ally.test.ts`
Expected: PASS.

- [ ] **Step 5: Añadir el aliado a `SimPanel`**

- Botón "Añadir aliado" con la lista de `loadStored()`. Sin builds guardadas, explicar cómo guardar una.
- Con `null`, mostrar el mensaje `sim.err.ally`; el modo normal sigue funcionando.
- Selector de quién actúa, objetivo del hechizo (mob, aliado o uno mismo), segunda fila de recursos, PV y armadura como barra aparte, y totales por personaje.
- Quitar al aliado elimina sus pasos, tras avisar cuántos se perderán.

- [ ] **Step 6: Comprobar tipos, compilación y navegador**

Run: `npm test && npm run build`
Expected: todo pasa.
Después, con `npm run dev`, guardar una build de curación, añadirla como aliado, lanzar una cura y un escudo, y comprobar el tope de armadura y la cura limitada a los PV que faltan.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Simulador: aliado para probar curas y escudos"
```

### Task 8: Validación con golpes reales

**Files:**
- Create: `src/lib/sim/real-hits.test.ts`
- Modify: `src/lib/sim/formulas.ts` si los datos contradicen algo

Esta tarea necesita datos de Francisco. Depende de la Task 7 solo para probar el aliado.

- [ ] **Step 1: Pedir los golpes reales**

Para cada caso, build, hechizo, posición, objetivo y daño mostrado: Yopuka normal, crítico y por la espalda; Sacrogrito en berserker; una cura y un escudo sobre un aliado. Pedir también cuánto da el combo de daño extra, si sabe uno que lo active.

- [ ] **Step 2: Escribir cada golpe como prueba y ejecutar**

Run: `npx vitest run src/lib/sim/real-hits.test.ts`
Expected: cada valor dentro de ±1 del daño real.

- [ ] **Step 3: Corregir o documentar**

Si un caso falla, depurar la causa antes de cambiar la fórmula. Confirmar con estos golpes `SPELL_MAX_LEVEL`, si andar cuenta en un combo y la regla de lado o espalda. Actualizar el spec con lo que se confirme.

- [ ] **Step 4: Commit**

```bash
git add src docs
git commit -m "Simulador: validación contra golpes reales del juego"
```
