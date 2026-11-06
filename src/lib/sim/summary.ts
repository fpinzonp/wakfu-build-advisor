// Totales por turno a partir de los resultados del motor (el motor ya da el total de toda la secuencia).

import type { StepResult, StepRow, Triple } from './engine';

type Kind = StepRow['kind'];

/** Turno de cada paso (desde 1). El fin de turno pertenece al turno que cierra. */
export function turnOfSteps(steps: StepResult[]): number[] {
  let turn = 1;
  return steps.map((s) => {
    const current = turn;
    if (s.step.type === 'endTurn') turn += 1;
    return current;
  });
}

/** Suma de los pasos válidos de un turno; las filas sin calcular no cuentan, igual que en el motor. */
export function turnTotals(steps: StepResult[], turn: number): Record<Kind, Triple> {
  const totals: Record<Kind, Triple> = {
    damage: { normal: 0, crit: 0, avg: 0 }, heal: { normal: 0, crit: 0, avg: 0 }, armor: { normal: 0, crit: 0, avg: 0 },
  };
  const turns = turnOfSteps(steps);
  steps.forEach((s, i) => {
    if (turns[i] !== turn || !s.ok || s.step.type !== 'cast') return;
    for (const row of s.rows) {
      if (row.uncalculated) continue;
      for (const k of ['normal', 'crit', 'avg'] as const) totals[row.kind][k] += row.value[k];
    }
  });
  return totals;
}
