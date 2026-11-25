import { describe, expect, it } from 'vitest';
import { multiMastCount } from '../../game';
import { activeSlots, fitDeck, type Spell } from '../../spells';
import { simulate, type SimActor, type SimInput, type SimStep } from '../engine';
import { auraFor, type Lineage } from './bellaphone';

const JAB: Spell = {
  id: 1, name: 'Golpe', el: 'air', lvl: 0, icon: 0, text: [],
  cast: {
    key: 'Jab', ap: 3, mp: 0, wp: 0, rangeMin: 1, rangeMax: 2, rangeMod: true, los: true, perTurn: null, target: 'st',
    lines: [{ kind: 'damage', side: 'enemy', min: 50, max: 105, critMin: 60, critMax: 132 }],
    conditional: [], stateGains: [], reasons: [], partial: false,
  },
};

function input(lineage: Lineage, steps: SimStep[], over: Partial<SimActor> = {}): SimInput {
  const main: SimActor = {
    id: 'main', name: 'Bella', classId: 'bellaphone', level: 245, lineage,
    stats: { mastMelee: 100, dmgPct: 0, crit: 20, mastCrit: 100 },
    mastery: { fire: 0, water: 0, earth: 0, air: 500 }, maxHp: 1000, ap: 6, mp: 4, wp: 6,
    spells: [JAB], start: { x: 5, y: 5 }, ...over,
  };
  return {
    actors: [main], comboExtraPct: 0, steps,
    target: { name: 'Mob', hp: 1e6, res: { fire: 0, water: 0, earth: 0, air: 0 }, resBack: 0, resCrit: 0, cell: { x: 6, y: 5 }, facing: 'w' },
  };
}
const aura: SimStep = { type: 'aura', actor: 'main' };
const jab: SimStep = { type: 'cast', actor: 'main', spell: 1, target: 'mob' };

describe('Bellaura', () => {
  it('el Bellaphone se queda solo con lo positivo', () => {
    expect(auraFor('pourpre', true)).toEqual({ dmgPct: 25, crit: 25 });
    expect(auraFor('turquoise', true)).toEqual({});
    expect(auraFor('turquoise', false)).toEqual({ dmgPct: -15, crit: -25 });
  });

  it('Púrpura sube un 25 % el daño y el crítico del Bellaphone hasta el fin del turno', () => {
    const base = simulate(input('pourpre', [jab])).steps[0].rows[0];
    const r = simulate(input('pourpre', [aura, jab, { type: 'endTurn' }, jab]));
    const buffed = r.steps[1].rows[0];
    expect(buffed.value.normal).toBe(Math.floor(base.value.normal * 1.25));
    expect(buffed.tags).toContain('sim.tag.bellaura');
    expect(buffed.warnings).toContain('sim.warn.bellaura');
    expect(r.steps[3].rows[0].value).toEqual(base.value);
  });

  it('Turquesa no penaliza al propio Bellaphone', () => {
    const base = simulate(input('turquoise', [jab])).steps[0].rows[0].value;
    expect(simulate(input('turquoise', [aura, jab])).steps[1].rows[0].value).toEqual(base);
  });

  it('Ébano baja 100 de resistencia al objetivo dentro de la zona', () => {
    const base = simulate(input('ebene', [jab])).steps[0].rows[0].value.normal;
    const down = simulate(input('ebene', [aura, jab])).steps[1].rows[0].value.normal;
    expect(down).toBeGreaterThan(base);
  });

  it('Ébano no alcanza a un objetivo a más de 2 casillas', () => {
    const far = { ...input('ebene', [aura]), target: { ...input('ebene', []).target, cell: { x: 9, y: 5 } } };
    const r = simulate(far);
    expect(r.steps[0].state.mobRes).toBeUndefined();
  });

  it('Marfil da 2 PA y 1 PW al momento; solo una vez por turno', () => {
    const r = simulate(input('ivoire', [aura, aura]));
    expect(r.steps[0].state.actors.main).toMatchObject({ ap: 8, wp: 7 });
    expect(r.steps[1]).toMatchObject({ ok: false, reason: 'sim.err.auraUsed' });
  });

  it('solo la activa un Bellaphone', () => {
    const r = simulate(input('pourpre', [aura], { classId: 'yopuka' }));
    expect(r.steps[0]).toMatchObject({ ok: false, reason: 'sim.err.notBellaphone' });
  });
});

describe('Bellaphone en la build', () => {
  it('tiene 18 casillas de hechizos activos', () => {
    expect(activeSlots('bellaphone')).toBe(18);
    expect(activeSlots('yopuka')).toBe(12);
    const spells: Spell[] = Array.from({ length: 20 }, (_, i) => ({ ...JAB, id: i + 1, cast: undefined }));
    const deck = { actives: spells.map((s) => s.id), passives: [] };
    expect(fitDeck(deck, spells, 245, 'bellaphone').actives).toHaveLength(18);
    expect(fitDeck(deck, spells, 245, 'yopuka').actives).toHaveLength(12);
  });

  it('el dominio en 3 elementos cubre los 4 desde la 1.94', () => {
    expect([1, 2, 3, 4].map(multiMastCount)).toEqual([1, 2, 4, 4]);
  });
});
