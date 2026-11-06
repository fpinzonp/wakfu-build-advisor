import { describe, expect, it } from 'vitest';
import type { StepResult, StepRow } from './engine';
import { turnOfSteps, turnTotals } from './summary';

const row = (avg: number, over: Partial<StepRow> = {}): StepRow =>
  ({ kind: 'damage', value: { normal: avg - 10, crit: avg + 10, avg }, tags: [], warnings: [], ...over });
const result = (step: StepResult['step'], rows: StepRow[] = [], ok = true): StepResult =>
  ({ step, ok, rows, state: { actors: {}, mobHp: 0, facing: 'w', turn: 1 } });
const cast = (rows: StepRow[], ok = true) => result({ type: 'cast', actor: 'main', spell: 1, target: 'mob' }, rows, ok);
const end = () => result({ type: 'endTurn' });

describe('turnOfSteps', () => {
  it('numera el turno de cada paso; el fin de turno pertenece al turno que cierra', () => {
    const steps = [cast([row(100)]), end(), cast([row(50)]), cast([row(70)]), end(), cast([])];
    expect(turnOfSteps(steps)).toEqual([1, 1, 2, 2, 2, 3]);
  });
});

describe('turnTotals', () => {
  const steps = [
    cast([row(100)]), cast([row(40, { uncalculated: true, value: { normal: 0, crit: 0, avg: 0 } })]),
    cast([row(999)], false), end(), cast([row(50), row(30, { kind: 'heal' })]),
  ];

  it('suma solo los pasos válidos del turno y deja fuera las filas sin calcular', () => {
    const t1 = turnTotals(steps, 1);
    expect(t1.damage).toEqual({ normal: 90, crit: 110, avg: 100 });
    expect(t1.heal.avg).toBe(0);
  });

  it('separa daño y cura en el segundo turno', () => {
    const t2 = turnTotals(steps, 2);
    expect(t2.damage.avg).toBe(50);
    expect(t2.heal.avg).toBe(30);
  });
});

describe('turnTotals por personaje', () => {
  const by = (actor: 'main' | 'ally', rows: StepRow[]) => result({ type: 'cast', actor, spell: 1, target: 'mob' }, rows);
  const steps = [by('main', [row(100)]), by('ally', [row(30, { kind: 'heal' })]), by('ally', [row(20)])];

  it('con un personaje suma solo sus pasos', () => {
    expect(turnTotals(steps, 1, 'main').damage.avg).toBe(100);
    expect(turnTotals(steps, 1, 'main').heal.avg).toBe(0);
    expect(turnTotals(steps, 1, 'ally').damage.avg).toBe(20);
    expect(turnTotals(steps, 1, 'ally').heal.avg).toBe(30);
  });

  it('sin personaje suma a todos', () => {
    expect(turnTotals(steps, 1).damage.avg).toBe(120);
  });
});
