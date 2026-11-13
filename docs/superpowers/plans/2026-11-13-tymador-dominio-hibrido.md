# Tymador: dominio híbrido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el optimizador sume dominio melé + distancia para el Tymador en sus roles de daño.

**Architecture:** Marca `hybridMastery` en la definición de clase; `derive` del optimizador recibe `classId` y, si la clase está marcada y el rol es de daño, añade el dominio del otro tipo.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-tymador-dominio-hibrido-design.md`

## Global Constraints
- Solo el Tymador lleva `hybridMastery: true`.
- Siempre activo (pasiva innata), sin depender del mazo.
- Sin rol nuevo; no tocar equipos, aptitudes, UI ni simulador.

## Review Focus
- Rol `melee` del Tymador: el término de espalda (`0.5 * mastBack`, y el extra con `back`) se mantiene igual; no duplicarlo.
- Clases sin la marca (Yopuka melé, Ocra distancia) dan exactamente el mismo `mastery` que antes.
- Roles no de daño (`heal`, `tank`) nunca suman el dominio extra aunque la clase tuviera la marca.

---

### Task 1: Dominio híbrido en el optimizador

**Files:**
- Modify: `src/lib/game.ts:122` (tipo de clase) y `:136` (Tymador)
- Modify: `src/lib/optimizer.ts:61` (exportar `toVector`), `:124-135` (`DeriveOptions`, `derive`)
- Test: `src/lib/optimizer.test.ts` (nuevo)

**Interfaces:**
- Produces: `export function toVector(stats, multiMast, multiRes, elements): Float64Array` (sin cambios de firma, solo `export`); `DeriveOptions = Pick<BuildRequest, 'role' | 'level' | 'berserk' | 'back' | 'classId'>`.

- [ ] **Step 1: Write the failing test** en `src/lib/optimizer.test.ts`

```ts
const opts = (role: Role, classId: string) => ({ role, level: 200, berserk: false, back: false, classId });
const vec = (stats: Record<string, number>) => toVector(stats, undefined, undefined, ['fire']);

it('Tymador melé cuenta el dominio distancia', () => {
  expect(derive(vec({ mastDist: 100 }), opts('melee', 'tymador')).mastery).toBe(100);
});
it('Tymador distancia cuenta el dominio melé', () => {
  expect(derive(vec({ mastMelee: 100 }), opts('dist', 'tymador')).mastery).toBe(100);
});
it('Tymador melé mantiene el término de espalda', () => {
  expect(derive(vec({ mastMelee: 100, mastDist: 50, mastBack: 40 }), opts('melee', 'tymador')).mastery).toBe(170);
});
it('otras clases no cambian', () => {
  expect(derive(vec({ mastDist: 100 }), opts('melee', 'yopuka')).mastery).toBe(0);
  expect(derive(vec({ mastMelee: 100 }), opts('dist', 'ocra')).mastery).toBe(0);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/optimizer.test.ts` — Expected: FAIL (`toVector` no exportado / mastery 0).

- [ ] **Step 3: Implement**
  - `game.ts`: añadir `hybridMastery?: boolean` al tipo de clase (comentario: pasiva del Tymador convierte melé↔distancia) y `hybridMastery: true` al Tymador.
  - `optimizer.ts`: exportar `toVector`; añadir `classId` a `DeriveOptions`; en `derive`, si `isDamageRole(role)` y `CLASSES.find(c => c.id === classId)?.hybridMastery`, sumar `t[IDX.mastDist]` en `melee` y `t[IDX.mastMelee]` en `dist`.

- [ ] **Step 4: Run** `npx vitest run` y `npx tsc --noEmit` — Expected: todo PASS, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game.ts src/lib/optimizer.ts src/lib/optimizer.test.ts docs/superpowers
git commit -m "Builds: dominio híbrido melé + distancia para el Tymador"
```
