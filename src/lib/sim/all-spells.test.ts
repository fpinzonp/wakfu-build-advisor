// Regresión con los datos reales: todos los hechizos activos de todas las clases pasan por `simulate`.
// Lo que no se calcula debe salir avisado en su fila; ningún lanzamiento válido puede quedar mudo.
import { describe, expect, it } from 'vitest';
import spellsJson from '../../../public/data/spells.json';
import type { Spell, SpellCast, SpellData } from '../spells';
import { simulate, type CastTarget, type SimActor, type SimInput, type StepResult, type StepRow } from './engine';
import { isCasterCentred, type Cell } from './formulas';

const data = spellsJson as unknown as SpellData;
const groups: [string, Spell[]][] = [['common', data.common], ...Object.entries(data.classes)];
const actives = groups.flatMap(([classId, list]) => list
  .filter((s) => s.el !== 'passive')
  .map((spell) => ({ classId, spell })));

const CENTER: Cell = { x: 1, y: 5 };  // junto al borde: deja sitio para los alcances mínimos largos

/** Casilla al alcance del hechizo: adyacente en los centrados en el lanzador, y a su alcance mínimo en el resto. */
function reachable(cast: SpellCast | undefined): Cell {
  const d = !cast || isCasterCentred(cast) ? 1 : Math.max(1, cast.rangeMin);
  return { x: CENTER.x + d, y: CENTER.y };
}

function run(classId: string, spell: Spell, target: CastTarget, level: number): StepResult {
  const cell = reachable(spell.cast);
  const main: SimActor = {
    id: 'main', name: 'Yo', classId, level,
    stats: { mastMelee: 300, mastDist: 300, mastCrit: 100, mastHeal: 100, crit: 25, dmgPct: 10 },
    mastery: { fire: 800, water: 800, earth: 800, air: 800 }, maxHp: 5000, ap: 30, mp: 30, wp: 30,
    spells: [spell], start: CENTER,
  };
  const ally: SimActor = { ...main, id: 'ally', name: 'Aliado', start: cell };
  const input: SimInput = {
    actors: target === 'ally' ? [main, ally] : [main],
    target: {
      name: 'Mob', hp: 1e7, res: { fire: 100, water: 100, earth: 100, air: 100 }, resBack: 0, resCrit: 0,
      // Con aliado, el mob se aparta para no compartir casilla.
      cell: target === 'ally' ? { x: 0, y: 0 } : cell, facing: 'w',
    },
    steps: [{ type: 'cast', actor: 'main', spell: spell.id, target }], comboExtraPct: 10,
  };
  return simulate(input).steps[0];
}

const finite = (row: StepRow) => [row.value, ...(row.raw ? [row.raw] : [])]
  .every((t) => [t.normal, t.crit, t.avg].every(Number.isFinite));

describe.each([['nivel 245', 245], ['nivel 1', 1]])('todos los hechizos activos (%s)', (_, level) => {
  it('hay hechizos de todas las clases', () => {
    expect(groups).toHaveLength(19);
    expect(actives.length).toBeGreaterThan(450);
  });

  it.each(['mob', 'self', 'ally'] as CastTarget[])('dirigidos a %s: cada lanzamiento válido da filas con valor o aviso', (target) => {
    const mute: string[] = [];
    const silent: string[] = [];
    const nan: string[] = [];
    const rejected: string[] = [];
    let valid = 0;
    for (const { classId, spell } of actives) {
      const step = run(classId, spell, target, level);
      if (!step.ok) {
        // Solo se rechaza lo que de verdad no llega: los hechizos de alcance 0 que no son de zona.
        if (spell.cast?.rangeMax !== 0 || isCasterCentred(spell.cast)) rejected.push(spell.name);
        continue;
      }
      valid++;
      if (step.rows.length === 0) mute.push(spell.name);
      for (const row of step.rows) {
        if (!finite(row)) nan.push(spell.name);
        const hasValue = !row.uncalculated && row.value.normal > 0;
        if (!hasValue && row.warnings.length === 0) silent.push(spell.name);
      }
    }
    expect(valid).toBeGreaterThan(0);
    expect(rejected).toEqual([]);
    expect(mute).toEqual([]);
    expect(silent).toEqual([]);
    expect(nan).toEqual([]);
  });
});

describe('hechizos centrados en el lanzador', () => {
  const find = (key: string) => actives.find(({ spell }) => spell.cast?.key === key)!;

  it.each(["Iop's Wrath", 'Burning Blood', 'Dice Roulette', 'Unhinging'])('%s golpea al mob adyacente', (key) => {
    const { classId, spell } = find(key);
    const step = run(classId, spell, 'mob', 245);
    expect(step.ok).toBe(true);
    const hit = step.rows.find((r) => r.kind === 'damage')!;
    expect(hit.uncalculated).toBeUndefined();
    expect(hit.value.normal).toBeGreaterThan(0);
  });

  it('todo hechizo de zona con alcance 0 trae su zona', () => {
    const centred = actives.filter(({ spell }) => spell.cast && isCasterCentred(spell.cast));
    expect(centred.map(({ spell }) => spell.cast!.key).sort()).toEqual(['Burning Blood', 'Dice Roulette', "Iop's Wrath", 'Unhinging']);
    expect(centred.every(({ spell }) => spell.cast!.zone)).toBe(true);
  });
});

describe('Rocknoceros y los demás hechizos con coletilla', () => {
  it('Rocknoceros calcula su golpe y avisa de lo que no lee', () => {
    const { classId, spell } = actives.find((a) => a.spell.cast?.key === 'Rocknoceros')!;
    const [row] = run(classId, spell, 'mob', 245).rows;
    expect(row.uncalculated).toBeUndefined();
    expect(row.value.normal).toBeGreaterThan(0);
    expect(row.warnings).toContain('sim.warn.secondary');
  });
});
