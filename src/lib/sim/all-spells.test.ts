// Regresión con los datos reales: todos los hechizos activos de todas las clases pasan por `simulate`.
// Lo que no se calcula debe salir avisado en su fila; ningún lanzamiento válido puede quedar mudo.
import { describe, expect, it } from 'vitest';
import spellsJson from '../../../public/data/spells.json';
import type { Spell, SpellCast, SpellData } from '../spells';
import { simulate, type CastTarget, type SimActor, type SimInput, type StepResult, type StepRow } from './engine';
import { castTarget } from './castTarget';
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

/** `cell` fija la casilla del mob (por defecto, la del alcance mínimo) y `hpPct` baja los PV del lanzador antes de lanzar. */
function run(classId: string, spell: Spell, target: CastTarget, level: number, opts: { cell?: Cell; hpPct?: number } = {}): StepResult {
  const cell = opts.cell ?? reachable(spell.cast);
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
    steps: [
      ...(opts.hpPct === undefined ? [] : [{ type: 'adjust' as const, hpPct: opts.hpPct }]),
      { type: 'cast', actor: 'main', spell: spell.id, target },
    ],
    comboExtraPct: 10,
  };
  const steps = simulate(input).steps;
  return steps[steps.length - 1];
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
        // Una cura que no cabe por tener los PV llenos conserva su valor bruto: está calculada.
        const hasValue = !row.uncalculated && (row.value.normal > 0 || (row.raw?.normal ?? 0) > 0);
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

describe('hechizos que antes no golpeaban al mob o quedaban sin calcular', () => {
  const find = (key: string) => actives.find(({ spell }) => spell.cast?.key === key)!;
  const realHit = (step: StepResult) => step.rows.find((r) => r.kind === 'damage' && !r.uncalculated && r.value.normal > 0);
  // Casilla del mob a la distancia dada del lanzador, sobre su fila.
  const at = (d: number): Cell => ({ x: CENTER.x + d, y: CENTER.y });

  // Con el objetivo automático del panel, sin aliado.
  it.each([
    'Pummel', 'Flaming Burp', 'Heads or Tails', 'Trampling', 'Hammer Claw', 'Fleeflee', 'Neurosis', 'Transfer', 'Sudden Chill',
  ])('%s da un valor contra el mob con el objetivo por defecto', (key) => {
    const { classId, spell } = find(key);
    const step = run(classId, spell, castTarget(spell, false), 245);
    expect(step.ok).toBe(true);
    expect(realHit(step)).toBeDefined();
  });

  it('Up to Scratch calcula su golpe de melé a 2 casillas y no golpea a distancia', () => {
    const { classId, spell } = find('Up to Scratch');
    const near = run(classId, spell, 'mob', 245, { cell: at(2) });
    expect(realHit(near)).toBeDefined();
    expect(near.rows.flatMap((r) => r.warnings)).not.toContain('sim.warn.conditional');
    expect(realHit(run(classId, spell, 'mob', 245, { cell: at(4) }))).toBeUndefined();
  });

  it('Light Speed golpea solo en berserker', () => {
    const { classId, spell } = find('Light Speed');
    expect(castTarget(spell, false)).toBe('mob');
    expect(realHit(run(classId, spell, 'mob', 245))).toBeUndefined();
    expect(realHit(run(classId, spell, 'mob', 245, { hpPct: 40 }))).toBeDefined();
  });

  // Su daño es solo de melé (1-2 casillas) y su alcance mínimo es 3: el mob nunca está a la vez a tiro y en melé.
  it('Capering no puede dar su daño: solo es de melé y no alcanza a menos de 3 casillas', () => {
    const { classId, spell } = find('Capering');
    expect(castTarget(spell, false)).toBe('mob');
    expect(spell.cast!.rangeMin).toBeGreaterThan(2);
    const step = run(classId, spell, 'mob', 245);
    expect(realHit(step)).toBeUndefined();
    expect(step.rows.length).toBeGreaterThan(0);  // la fila avisa de lo que no recibe el mob (la armadura es de aliados)
  });

  it('ningún hechizo con efecto sobre enemigos va a uno mismo por defecto: el efecto llega a la fila o a un aviso', () => {
    const bad: string[] = [];
    for (const { classId, spell } of actives) {
      const c = spell.cast;
      if (!c || (c.rangeMax === 0 && !isCasterCentred(c))) continue;
      const enemy = [...c.lines, ...(c.berserkLines ?? []), ...c.conditional.flatMap((b) => b.lines)].some((l) => l.side === 'enemy');
      if (!enemy) continue;
      const target = castTarget(spell, false);
      const step = run(classId, spell, target, 245);
      const reached = step.ok && step.rows.some((r) => r.kind === 'damage' ? (!r.uncalculated || r.warnings.length > 0) : r.warnings.length > 0);
      if (target !== 'mob' || !reached) bad.push(`${c.key}:${target}`);
    }
    // Los de efectos enemigos que no son daño (restar PM, empujar) pueden quedar sin fila de daño ni aviso: solo cuentan los de daño.
    const damaging = bad.filter((b) => {
      const c = actives.find(({ spell }) => spell.cast?.key === b.split(':')[0])!.spell.cast!;
      return [...c.lines, ...(c.berserkLines ?? []), ...c.conditional.flatMap((x) => x.lines)].some((l) => l.side === 'enemy' && l.kind === 'damage');
    });
    expect(damaging).toEqual([]);
  });

  it('calcula un valor real contra el mob en al menos 240 hechizos (en el nivel 245, con el objetivo por defecto)', () => {
    const withValue = actives.filter(({ classId, spell }) => realHit(run(classId, spell, castTarget(spell, false), 245)));
    expect(withValue.length).toBeGreaterThanOrEqual(240);
  });
});
