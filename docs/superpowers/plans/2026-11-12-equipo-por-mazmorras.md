# Equipo por mazmorras — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La sección "Equipos" recomienda un equipo base de 6 que cubre el máximo de las 27 mazmorras, muestra la cobertura total y por franja, y sugiere (y aplica) cambios de una clase para las mazmorras sin cubrir.

**Architecture:** Un dato nuevo (`src/lib/dungeons/requirements.ts`) dice qué exige cada mazmorra. Una lógica nueva y pura (`src/lib/teamDungeons.ts`) cruza esas exigencias con lo que aporta cada clase (`KIT` en `src/lib/teams.ts`, ampliado con la necesidad "colocación"). `TeamsPanel` se rehace sobre esa lógica; `DungeonPanel` acepta abrir una mazmorra concreta.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (tests de lógica y `renderToString` sin navegador).

**Spec:** `docs/superpowers/specs/2026-11-12-equipo-por-mazmorras-design.md`

## Global Constraints

- Todo texto visible en es, en y fr (`L10n` = `Record<Lang, string>`; claves i18n en `src/locales/{es,en,fr}.ts`, que deben tener las mismas claves).
- Solo cuentan las mazmorras de `DUNGEONS`; las de `EXCLUDED` no.
- Equipo base siempre de 6; la clase y rol del usuario son siempre `team[0]` y nunca se sustituyen.
- Una exigencia solo se anota si la guía (`dungeon.guide`) o los pasos ya escritos la sostienen; la dudosa va como recomendada y con comentario de origen.
- Exigencia obligatoria sin `level`: se cumple con cobertura ≥ 2. Tamaño de grupo: 6 salvo que la guía diga otro.
- Pesos de la puntuación general: los actuales de `rooms`.
- Aviso visible: exigencias tomadas de guías, no comprobadas en el juego.
- Trabajar en la rama `equipo-mazmorras`; un commit por tarea.

## Review Focus

1. Clase/rol del usuario sin daño (p. ej. Aniripsa curandero): el equipo base debe incluir daño; una mazmorra sin exigencias cuenta como cubierta solo si el (sub)grupo tiene un rol de daño. → test en Task 3.
2. Mazmorra que ningún cambio de una sola clase arregla: se muestra qué falta sin botón de cambio. → test en Task 3 y Task 6.
3. Mazmorra de 3 personajes: el subgrupo incluye siempre al usuario y la cobertura se juzga sobre él, no sobre los 6. → test en Task 3.
4. Aplicar una sugerencia que saca una clase fijada a mano: la fijada sale de `pins`, entra la nueva, y "Deshacer" restaura equipo y `pins`. → test en Task 6.
5. Cambio de idioma: nombres de mazmorra, motivos de cada exigencia y notas de colocación salen en el idioma activo. → test en Task 6.

---

### Task 1: Necesidad "colocación" en el modelo de clases

**Files:**
- Modify: `src/lib/teams.ts`
- Modify: `src/locales/es.ts`, `src/locales/en.ts`, `src/locales/fr.ts` (clave `team.need.place` y `team.place.{push,pull,swap,teleport}`)
- Create: `src/lib/teams.test.ts`

**Interfaces:**
- Produces:
  - `export type Need = 'protect' | 'heal' | 'revive' | 'debuff' | 'support' | 'control' | 'melee' | 'ranged' | 'place'` (y `'place'` al final de `NEEDS`).
  - `export type PlaceKind = 'push' | 'pull' | 'swap' | 'teleport'`.
  - `Contribution` gana `place?: PlaceKind` (obligatorio cuando `need === 'place'`). Helper `cp(kind, power, spell, es, en, fr, role?)` que crea `{ need: 'place', place: kind, ... }`.
  - `export function memberPlaces(m: Member): Map<PlaceKind, number>` — mejor `power` por subtipo según `contributions(m)`.

- [ ] **Step 1: Crear rama** `git checkout -b equipo-mazmorras`.

- [ ] **Step 2: Escribir tests que fallan** en `src/lib/teams.test.ts`:
  - `cada hechizo de KIT existe en su clase`: lee `public/data/spells.json` con `fs.readFileSync` y para cada `KIT[classId]` comprueba que `x.spell` está en `data.classes[classId].map(s => s.id)`.
  - `todo aporte de colocación tiene subtipo`: `x.need === 'place'` ⇔ `x.place !== undefined`.
  - `hay al menos una clase por subtipo`: para cada `PlaceKind`, alguna clase de `KIT` lo tiene.
  - `memberPlaces respeta el rol`: un aporte con `role` no aparece si el miembro juega otro rol.

- [ ] **Step 3: Ejecutar** `npx vitest run src/lib/teams.test.ts` → FAIL (`PlaceKind`/`memberPlaces` no existen).

- [ ] **Step 4: Curar los aportes de colocación.** Buscar en `public/data/spells.json` los hechizos de cada clase cuyo `text` diga empujar/atraer/intercambiar/teletransportar (en inglés: "Push", "Pull"/"Attract", "Swap"/"Exchange position"/"Transpose", "Teleport"). Añadir a `KIT` solo los efectos claros, con id, nota en 3 idiomas, `power` (3 = lo hace a distancia y sin condición; 2 = con condición o corto alcance; 1 = muy limitado) y `role` si depende del rol. Implementar `PlaceKind`, `cp`, `memberPlaces`, y `'place'` en `Need`/`NEEDS`; en `WEIGHTS.rooms` peso `place: 1` (y en los demás contenidos el mismo valor hasta que Task 4 los elimine).

- [ ] **Step 5: Ejecutar** `npx vitest run` → PASS todo (incluida la prueba de claves iguales en los 3 idiomas).

- [ ] **Step 6: Commit** `Equipos: necesidad de colocación en las clases`.

---

### Task 2: Tipos y registro de exigencias por mazmorra

**Files:**
- Create: `src/lib/dungeons/requirements.ts`
- Modify: `src/lib/dungeons/dungeons.test.ts`

**Interfaces:**
- Consumes: `Need`, `PlaceKind` (Task 1); `L10n`, `DUNGEONS` (existentes).
- Produces:
  ```ts
  export interface Requirement {
    need: Need;
    required: boolean;      // true = obligatoria; false = recomendada
    level?: 1 | 2 | 3;      // por defecto 2
    count?: number;         // personajes distintos que deben cumplirla; por defecto 1
    place?: PlaceKind;      // solo con need 'place'; ausente = cualquier subtipo
    why: L10n;              // motivo visible
  }
  export interface DungeonNeeds { size: 3 | 4 | 6; reqs: Requirement[] }
  export const REQUIREMENTS: Record<string, DungeonNeeds>;
  export const needsOf: (id: string) => DungeonNeeds;   // lanza si no hay entrada
  ```

- [ ] **Step 1: Tests que fallan** en `dungeons.test.ts`, bloque `describe('exigencias')`:
  - cada `DUNGEONS[i].id` tiene entrada en `REQUIREMENTS`, y no hay entradas de ids que no estén en `DUNGEONS`;
  - cada `why` tiene `es`, `en`, `fr` no vacíos;
  - `place` solo aparece con `need === 'place'`; `count` ≥ 1 si existe;
  - `size` ∈ {3, 4, 6}.

- [ ] **Step 2: Ejecutar** `npx vitest run src/lib/dungeons/dungeons.test.ts` → FAIL.

- [ ] **Step 3: Crear `requirements.ts`** con los tipos, `needsOf`, y una entrada `{ size: 6, reqs: [] }` por cada mazmorra (con comentario `// pendiente de curar` en cada una). Las Tasks 5a-5c las rellenan.

- [ ] **Step 4: Ejecutar** → PASS. **Step 5: Commit** `Equipos: registro de exigencias por mazmorra`.

---

### Task 3: Lógica de cobertura por mazmorra

**Files:**
- Create: `src/lib/teamDungeons.ts`, `src/lib/teamDungeons.test.ts`

**Interfaces:**
- Consumes: `Member`, `coverage`, `memberPower`, `memberPlaces`, `scoreTeam` (Task 4 le quita `content`; hasta entonces llamar con `'rooms'`), `CLASSES`, `isDamageRole` (`src/lib/game.ts`), `DUNGEONS`, `byTier`, `Requirement`, `DungeonNeeds`, `needsOf`.
- Produces (todas aceptan un último parámetro opcional `needs: (id: string) => DungeonNeeds = needsOf` para que los tests inyecten exigencias):
  ```ts
  export function meets(group: Member[], r: Requirement): boolean;
  export interface DungeonResult { id: string; covered: boolean; missing: Requirement[]; group: Member[]; recommendedMet: number }
  export function dungeonResult(team: Member[], id: string, needs?): DungeonResult;
  export interface TeamReport { covered: number; total: number; tiers: { tier: [number, number]; covered: number; total: number; results: DungeonResult[] }[] }
  export function teamReport(team: Member[], needs?): TeamReport;
  export function recommendBaseTeam(fixed: Member[], needs?): Member[];
  export interface Fix { index: number; member: Member; total: number }
  export function suggestFix(team: Member[], id: string, needs?): Fix | null;
  export function dungeonDiff(before: Member[], after: Member[], needs?): { gained: string[]; lost: string[] };
  ```

Reglas (del spec):
- `meets`: umbral `t = r.level ?? 2`. Si `r.place` o `(r.count ?? 1) > 1`: cuenta los miembros que individualmente cumplen (`memberPower(m)[r.need] >= t`, y si `r.place`, `(memberPlaces(m).get(r.place) ?? 0) >= t`) y exige `>= (r.count ?? 1)`. Si no: `coverage(group)[r.need] >= t`.
- `dungeonResult`: si `size === 6` (o el equipo tiene ≤ size miembros) el grupo es el equipo entero; si no, entre los subgrupos de `size` que incluyen `team[0]` elige el que cumple más obligatorias, luego más recomendadas, luego mayor `scoreTeam`. `covered` = cumple todas las obligatorias **y** el grupo tiene algún miembro con `isDamageRole(role)`. `missing` = obligatorias no cumplidas (más un `Requirement` sintético `{ need: 'melee', required: true, why: <texto i18n de "falta daño"> }` si no hay daño; el texto lo pone la UI, aquí basta con `need`).
- `recommendBaseTeam`: misma búsqueda que `recommendTeam` (añadir por ganancia y luego cambios uno a uno, sin repetir clase), con puntuación `1000 * covered + 10 * Σ recommendedMet + scoreTeam(team)`. Extraer de `teams.ts` la búsqueda a `searchTeam(fixed: Member[], size: number, score: (t: Member[]) => number): Member[]` y reutilizarla en ambos.
- `suggestFix`: para cada `index` 1..5 y cada clase que no está en el equipo, con `bestRole(classId, team, index)`, prueba el cambio; entre los que dejan cubierta la mazmorra `id`, devuelve el de mayor `teamReport(...).covered` (empate: mayor puntuación de `recommendBaseTeam`). `null` si ninguno.

- [ ] **Step 1: Tests que fallan** en `teamDungeons.test.ts`, con exigencias inyectadas (no dependen de la curación):
  - `meets` con umbral por defecto: grupo con Aniripsa curandero cumple `heal`; grupo con solo Sadida daño (`heal` power 2 con `role: 'heal'`, no cuenta) no cumple.
  - `meets` con `count: 2` de `place`: falla con una clase que coloca, pasa con dos.
  - `meets` con `place: 'pull'`: una clase que solo empuja no cumple.
  - **Review Focus 1**: mazmorra sin exigencias + grupo sin roles de daño → `covered === false`; con un `melee` → `true`.
  - **Review Focus 3**: mazmorra `size: 3` que exige `revive`; equipo de 6 con Zurcarák → `group.length === 3`, `group[0]` es el usuario, incluye Zurcarák, `covered`.
  - `teamReport` suma por franja igual que `byTier()` (mismas franjas, mismos totales).
  - `recommendBaseTeam([{classId:'aniripsa', role:'heal'}])` → 6 miembros, clases distintas, `[0]` intacto, alguno con rol de daño.
  - `suggestFix` devuelve un cambio que deja la mazmorra cubierta y `index !== 0`; **Review Focus 2**: exigencia imposible (`count: 7`) → `null`.
  - `dungeonDiff` reporta en `gained`/`lost` los ids que cambian de estado.

- [ ] **Step 2: Ejecutar** `npx vitest run src/lib/teamDungeons.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `teamDungeons.ts` y `searchTeam` en `teams.ts` (con `recommendTeam` usándola; sus resultados no cambian).
- [ ] **Step 4: Ejecutar** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `Equipos: cobertura y recomendación por mazmorra`.

---

### Task 4: Quitar los tipos de contenido de `teams.ts`

**Files:**
- Modify: `src/lib/teams.ts`, `src/lib/teamDungeons.ts`, `src/lib/teams.test.ts`

**Interfaces:**
- Produces: `WEIGHTS: Record<Need, number>` (valores actuales de `rooms` + `place: 1`); `scoreTeam(team)`, `mainNeed(team, index)`, `bestRole(classId, team, index)`, `replacements(team, index, max?)` sin parámetro `content`. Se eliminan `Content`, `SIX_CONTENTS`, `TeamSize`, `contentSize`, `recommendTeam`, `bestTrio`, `lostNeeds`.

- [ ] **Step 1: Test** en `teams.test.ts`: `scoreTeam` de un equipo fijo da el mismo valor que antes con `'rooms'` (calcularlo antes del cambio y fijarlo como número esperado).
- [ ] **Step 2: Hacer el cambio** en `teams.ts` y `teamDungeons.ts`. Para que `TeamsPanel.tsx` siga compilando hasta Task 6, las exportaciones viejas que usa (`SIX_CONTENTS`, `Content`, `TeamSize`, `recommendTeam`, `bestTrio`, `lostNeeds`) se quedan, marcadas `/** @deprecated se borra en Task 6 */`, aceptando y descartando el parámetro `content`. Task 6 las borra. Ejecutar `npx vitest run` y `npx tsc -b` → PASS.
- [ ] **Step 3: Commit** `Equipos: una sola puntuación general`.

---

### Tasks 5a / 5b / 5c: Curar las exigencias

Una tarea por tramo; mismas reglas y mismos pasos:

- **5a:** 36-50, 66-80, 81-95, 96-110 (10 mazmorras).
- **5b:** 111-125, 126-140, 141-155 (10 mazmorras).
- **5c:** 156-170, 171-185 (7 mazmorras).

**Files:** Modify `src/lib/dungeons/requirements.ts`; Test `src/lib/dungeons/dungeons.test.ts`.

**Fuentes, por mazmorra:** el archivo `src/lib/dungeons/data/<id>.ts` (comentario de cabecera, `condition`, `steps`, `move` con `path`) y su `guide` (wakfu.guide, en francés) leída con WebFetch.

**Qué anotar:**
- Mecánica que obliga a mover una pieza → `place` obligatoria, con subtipo si la guía lo precisa (empujar hacia, atraer hacia, intercambiar, teletransportar); `count` si la guía dice que lo hacen dos personajes a la vez.
- Resurrección, quitar PA/PM, bajar resistencias, daño a distancia/cuerpo a cuerpo obligatorio (p. ej. el jefe castiga el cuerpo a cuerpo), protección o curas fuertes: solo si la guía lo exige; si lo "aconseja", `required: false`.
- `size` distinto de 6 solo si la guía lo dice.
- Cada exigencia con comentario `// guía: «cita breve en francés»` o `// pasos: sala X, paso N`.
- Quitar el `// pendiente de curar` de las mazmorras hechas.

- [ ] **Step 1: Test que falla:** en `dungeons.test.ts`, lista `CURATED` con los ids del tramo; `it.each` comprueba que el archivo no marca esas mazmorras como pendientes — implementar como un `Set` exportado `PENDING` en `requirements.ts` del que se quitan los ids curados; test: `CURATED.every(id => !PENDING.has(id))`. En 5c además: `PENDING.size === 0` (y entonces se borra `PENDING` y el test).
- [ ] **Step 2: Ejecutar** → FAIL.
- [ ] **Step 3: Curar** las mazmorras del tramo.
- [ ] **Step 4: Ejecutar** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `Equipos: exigencias del tramo <x-y>`.

---

### Task 6: Pantalla de Equipos por mazmorras

**Files:**
- Modify: `src/TeamsPanel.tsx`, `src/styles.css`, `src/locales/{es,en,fr}.ts`, `src/App.tsx`, `src/DungeonPanel.tsx`
- Create: `src/TeamsPanel.test.tsx`

**Interfaces:**
- Consumes: todo lo de Tasks 3-4.
- Produces:
  - `TeamsPanel` gana prop `onOpenDungeon: (id: string) => void`.
  - `DungeonPanel` gana prop `focus?: { id: string; n: number }`; un `useEffect` sobre `focus?.n` llama a `pickDungeon(focus.id)`.
  - `App`: estado `dungeonFocus`; `onOpenDungeon = id => { setDungeonFocus(f => ({ id, n: (f?.n ?? 0) + 1 })); setSection('dungeons'); }`.
  - Funciones puras exportadas de `TeamsPanel.tsx` para test: `applySwap(state: { team: Member[]; pins: string[] }, index: number, m: Member): { team: Member[]; pins: string[] }` (saca la clase anterior de `pins`, mete la nueva) y `initiallyOpen(report: TeamReport): boolean[]` (abierta = franja con `covered < total`).

Pantalla, de arriba abajo (spec "Pantalla"):
1. Tu clase / Tu rol (sin tamaño ni contenido). Al cambiarlos: `recommendBaseTeam([{classId, role}])`, `pins = []`.
2. Lista del equipo y detalle de cada miembro como hoy (alternativas con `replacements`, "Elegir otra clase", "Crear build"). Se quita el panel "Si van solo 3".
3. Cobertura: "22 / 27 mazmorras cubiertas" y una barra por franja (`tiers`).
4. Franjas plegables con `<details>` (abiertas según `initiallyOpen`), resumen "66–80 · 2/3". Dentro: primero las no cubiertas — nombre (botón/enlace que llama `onOpenDungeon`), ⚠, lista de `missing` con su `why` en el idioma activo (y para `place`, el subtipo), subgrupo si `size < 6` ("Grupo de 3: …"), y si `suggestFix` no es `null`, botón "Cambia {sale} → {entra} · cubre {total}/{n}" que aplica el cambio con `applySwap`; si es `null`, texto "Ningún cambio de una sola clase la cubre". Después, en una línea, las cubiertas con ✓.
5. Aviso de exigencias tomadas de guías.

Aviso tras un cambio (sugerencia o alternativa): "Ganas: {mazmorras}. Pierdes: {mazmorras}." con `dungeonDiff`, botón "Deshacer" (restaura `team` y `pins`), y "Ver equipo recomendado" que llama `recommendBaseTeam(fijados)` con `fijados = team[0] + pins`, igual que el flujo actual de propuesta.

Código: borrar de `teams.ts` las exportaciones `@deprecated` de Task 4.

i18n: borrar `team.size*`, `team.content*`, `team.trio*`, `team.lost`, `team.noLoss`; añadir las claves nuevas en los 3 idiomas; actualizar `team.intro`.

- [ ] **Step 1: Tests que fallan** en `TeamsPanel.test.tsx` (mismo arranque que `DungeonPanel.test.tsx`: `vi.stubGlobal('document', …)`, `setLang('es')`, `renderToString`):
  - monta con `/ 27 mazmorras` (o `DUNGEONS.length`), una franja por `byTier()` y el aviso de guías;
  - `initiallyOpen` abre solo franjas incompletas;
  - **Review Focus 4**: `applySwap({ team, pins: ['feca'] }, i, ocra)` sobre el índice de Feca → `pins` sin `feca` y con `ocra`; el estado anterior guardado para deshacer es idéntico al de entrada;
  - **Review Focus 2**: con exigencias inyectadas que nada arregla, el HTML contiene "Ningún cambio de una sola clase" y no el botón de cambio (para inyectar, `TeamsPanel` acepta prop opcional `needs` que pasa a la lógica);
  - **Review Focus 5**: con `setLang('fr')`, el HTML contiene el `name.fr` de una mazmorra y el `why.fr` de una exigencia;
  - `DungeonPanel` con `focus={{ id: DUNGEONS[3].id, n: 1 }}` — comprobar `pickDungeon` vía la función pura que use el effect (exportar `focusTarget(focus)` que devuelve el id válido o `DUNGEONS[0].id`).
- [ ] **Step 2: Ejecutar** `npx vitest run src/TeamsPanel.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** la pantalla, los estilos (reusar tokens de `styles.css`; barras como las de cobertura actuales) y el cableado de `App`.
- [ ] **Step 4: Ejecutar** `npx vitest run` y `npm run build` → PASS y build sin errores.
- [ ] **Step 5: Probar en el navegador** (`npm run dev`): cambiar clase, aplicar una sugerencia, deshacer, abrir una mazmorra desde la lista, cambiar idioma, ancho de móvil (375 px) sin scroll horizontal.
- [ ] **Step 6: Commit** `Equipos: pantalla por mazmorras`.
