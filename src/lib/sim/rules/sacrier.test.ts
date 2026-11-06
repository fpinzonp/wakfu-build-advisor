import { describe, expect, it } from 'vitest';
import type { Spell, SpellCast, SpellLine } from '../../spells';
import { CLASS_RULES, simulate, type SimActor, type SimInput, type SimStep } from '../engine';
import { sacrierRules } from './sacrier';

const line = (kind: SpellLine['kind'], min: number, max: number, side: SpellLine['side'] = kind === 'damage' ? 'enemy' : 'caster'): SpellLine =>
  ({ kind, side, min, max, critMin: min, critMax: max });
const dmg = (min = 50, max = 105) => line('damage', min, max);

function spell(id: number, key: string, ap: number, over: Partial<SpellCast> = {}, wp = 0): Spell {
  return {
    id, name: key, el: 'air', lvl: 0, icon: 0, text: [],
    cast: {
      key, ap, mp: 0, wp, rangeMin: 1, rangeMax: 4, rangeMod: false, los: true, perTurn: null, target: 'st',
      lines: [dmg()], conditional: [], stateGains: [], reasons: [], partial: false, ...over,
    },
  };
}

// Pie Rocoso, Aplastar y Aversión con las cifras de la wiki.
const ROCKY = spell(1, 'Rocky Foot', 3, {
  lines: [], reasons: ['conditional'],
  conditional: [
    { when: 'If the Sacrier has no Armor', lines: [line('damage', 3, 91), line('armor', 6, 28)] },
    { when: 'If the Sacrier has Armor', lines: [line('damage', 4, 121)] },
  ],
});
const SMASHES = spell(2, 'Smashes', 5, {
  lines: [line('damage', 5, 176)], reasons: ['conditional', 'secondary'],
  conditional: [
    { when: 'If the Sacrier has 25% or more of their max HP as Armor', lines: [line('damage', 8, 264)] },
    { when: 'Otherwise: 10-52 Armor', lines: [] },
  ],
});
const AVERSION = spell(3, 'Aversion', 4, {
  lines: [line('damage', 3, 98)], reasons: ['conditional'],
  conditional: [{ when: "If the target's % HP is higher than the Sacrier's", lines: [line('damage', 4, 131)] }],
});
const ASSAULT = spell(4, 'Assault', 1, { lines: [line('armor', 4, 18)], berserkLines: [line('damage', 2, 60)] });
const FIST = spell(5, "Sacrier's Fist", 2, { lines: [line('damage', 2, 75)] });
const BLOOD_BURN = spell(6, 'Burning Blood', 4, { lines: [line('damage', 4, 151)] });
const PUNITION = spell(7, 'Punition', 3, {
  lines: [line('damage', 6, 197)], reasons: ['conditional'],
  conditional: [{ when: "If the Sacrier doesn't have 100 Fury", lines: [] }],
});
const PLAIN = spell(8, 'Plain', 1);
const MOTION = spell(9, 'Motion Sickness', 2, { lines: [], berserkLines: [line('damage', 2, 60)] });

function fixture(over: { actor?: Partial<SimActor>; mobHp?: number; mobCell?: { x: number; y: number } } = {}): SimInput {
  const main: SimActor = {
    id: 'main', name: 'Yo', classId: 'sacrogrito', level: 245,
    stats: { mastMelee: 100, mastDist: 0, mastBerserk: 300, crit: 0 },
    mastery: { fire: 0, water: 0, earth: 0, air: 500 }, maxHp: 1000, ap: 20, mp: 5, wp: 5,
    spells: [ROCKY, SMASHES, AVERSION, ASSAULT, FIST, BLOOD_BURN, PUNITION, PLAIN, MOTION],
    start: { x: 5, y: 5 }, ...over.actor,
  };
  return {
    actors: [main],
    target: {
      name: 'Mob', hp: over.mobHp ?? 1e6, res: { fire: 0, water: 0, earth: 0, air: 0 }, resBack: 0, resCrit: 0,
      cell: over.mobCell ?? { x: 6, y: 5 }, facing: 'w',
    },
    steps: [], comboExtraPct: 0,
  };
}

const cast = (s: Spell): SimStep => ({ type: 'cast', actor: 'main', spell: s.id, target: 'mob' });
const hp = (hpPct: number): SimStep => ({ type: 'adjust', hpPct });
const armor = (n: number): SimStep => ({ type: 'adjust', armor: n });
const run = (steps: SimStep[], input = fixture()) => simulate({ ...input, steps });
const mainOf = (r: ReturnType<typeof run>, i: number) => r.steps[i].state.actors.main!;

// Con 500 de aire y 100 de melé: 105 × 7 = 735; con berserker (+300): 105 × 10 = 1050.
const CALM = 735;
const BERSERK = 1050;

describe('Sacrogrito: berserker', () => {
  it('suma maestría berserker por debajo del 50 %', () => {
    const r = run([hp(49), cast(PLAIN)]);
    expect(r.steps[1].rows[0].value.normal).toBe(BERSERK);
    expect(r.steps[1].rows[0].tags).toContain('sim.tag.berserk');
  });

  it('no la suma con exactamente 50 %', () => {
    const r = run([hp(50), cast(PLAIN)]);
    expect(r.steps[1].rows[0].value.normal).toBe(CALM);
    expect(r.steps[1].rows[0].tags).not.toContain('sim.tag.berserk');
  });

  it('usa berserkLines en berserker y cuesta 1 PW más', () => {
    const calm = run([cast(ASSAULT)]);
    expect(calm.steps[0].rows[0].kind).toBe('armor');
    expect(mainOf(calm, 0).wp).toBe(5);

    const hurt = run([hp(40), cast(ASSAULT)]);
    expect(hurt.steps[1].rows[0].kind).toBe('damage');
    expect(hurt.steps[1].rows[0].value.normal).toBe(Math.floor(60 * 10));
    expect(mainOf(hurt, 1).wp).toBe(4);
  });

  it('rechaza el hechizo de berserker sin el PW extra y no cambia nada', () => {
    const input = fixture({ actor: { wp: 0 } });
    const r = run([hp(40), cast(ASSAULT)], input);
    expect(r.steps[1].ok).toBe(false);
    expect(r.steps[1].reason).toBe('sim.err.wp');
    expect(mainOf(r, 1).ap).toBe(20);
    // Sin berserker no hace falta PW.
    expect(run([cast(ASSAULT)], input).steps[0].ok).toBe(true);
  });

  it('el coste extra de Enfermedad del Movimiento en berserker es 1 PA', () => {
    const input = fixture({ actor: { ap: 2 } });
    const r = run([hp(40), cast(MOTION)], input);
    expect(r.steps[1].ok).toBe(false);
    expect(r.steps[1].reason).toBe('sim.err.ap');
    expect(run([hp(40), cast(MOTION)], fixture({ actor: { ap: 3 } })).steps[1].ok).toBe(true);
  });
});

describe('Sacrogrito: coste de PV', () => {
  it('el retorno de llama tras el golpe no da berserker a ese golpe', () => {
    // 52 % → el golpe va sin berserker; después el Puño baja 5 % de los PV máximos (47 %).
    const r = run([hp(52), cast(FIST), cast(FIST)]);
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(75 * 7));
    expect(r.steps[1].rows[0].tags).not.toContain('sim.tag.berserk');
    expect(mainOf(r, 1).hp).toBe(470);
    // El segundo ya parte en berserker.
    expect(r.steps[2].rows[0].tags).toContain('sim.tag.berserk');
    expect(mainOf(r, 2).hp).toBe(420);
  });

  it('el coste previo sí activa berserker en ese golpe', () => {
    // 55 % → Sangre Ardiente baja 10 % antes de pegar (45 %).
    const r = run([hp(55), cast(BLOOD_BURN)]);
    expect(r.steps[1].rows[0].tags).toContain('sim.tag.berserk');
    expect(r.steps[1].rows[0].value.normal).toBe(151 * 10);
    expect(mainOf(r, 1).hp).toBe(450);
  });

  it('Punición deja los PV en 20 % antes del golpe y avisa de la Furia', () => {
    const r = run([cast(PUNITION)]);
    expect(mainOf(r, 0).hp).toBe(200);
    expect(r.steps[0].rows[0].tags).toContain('sim.tag.berserk');
    expect(r.steps[0].rows[0].value.normal).toBe(197 * 10);
    expect(r.steps[0].rows[0].warnings).toContain('sim.warn.conditional');
  });

  it('los PV no bajan de 1', () => {
    const r = run([hp(3), cast(BLOOD_BURN), cast(FIST)]);  // 30 PV
    expect(mainOf(r, 1).hp).toBe(1);
    expect(mainOf(r, 2).hp).toBe(1);
    expect(run([cast(PUNITION)], fixture({ actor: { maxHp: 4 } })).steps[0].state.actors.main!.hp).toBe(1);
  });

  it('un hechizo rechazado no cobra PV', () => {
    const r = run([hp(60), cast(BLOOD_BURN)], fixture({ actor: { ap: 3 } }));
    expect(r.steps[1].ok).toBe(false);
    expect(mainOf(r, 1).hp).toBe(600);
  });
});

describe('Sacrogrito: armadura y condiciones', () => {
  it('Pie Rocoso sin armadura usa 3-91 y da armadura', () => {
    const r = run([cast(ROCKY)]);
    expect(r.steps[0].rows.map((x) => x.kind)).toEqual(['damage', 'armor']);
    expect(r.steps[0].rows[0].value.normal).toBe(Math.floor(91 * 7));
    expect(r.steps[0].rows[0].warnings).not.toContain('sim.warn.conditional');
    expect(mainOf(r, 0).armor).toBeGreaterThan(0);
  });

  it('Pie Rocoso con armadura usa 4-121 y gasta el 5 % de los PV máximos', () => {
    const r = run([armor(200), cast(ROCKY)]);
    expect(r.steps[1].rows.map((x) => x.kind)).toEqual(['damage']);
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(121 * 7));
    expect(mainOf(r, 1).armor).toBe(150);
  });

  it('Aplastar con 25 % de PV máximos en armadura usa 8-264 y la consume', () => {
    const r = run([armor(300), cast(SMASHES)]);
    expect(r.steps[1].rows).toHaveLength(1);
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(264 * 7));
    expect(mainOf(r, 1).armor).toBe(50);
  });

  it('Aplastar justo con el 25 % entra en la rama alta; con menos no', () => {
    expect(run([armor(250), cast(SMASHES)]).steps[1].rows[0].value.normal).toBe(Math.floor(264 * 7));
    const low = run([armor(249), cast(SMASHES)]);
    expect(low.steps[1].rows[0].value.normal).toBe(Math.floor(176 * 7));
    expect(mainOf(low, 1).armor).toBe(249);
    // La armadura de la otra rama no se calcula: se avisa.
    expect(low.steps[1].rows[0].warnings).toContain('sim.warn.conditional');
  });

  it('Aversión usa 4-131 si el objetivo tiene más % de PV que el Sacrogrito', () => {
    const base = run([cast(AVERSION)]);  // 100 % contra 100 %: no es mayor
    expect(base.steps[0].rows[0].value.normal).toBe(Math.floor(98 * 7));
    const hurt = run([hp(60), cast(AVERSION)]);
    expect(hurt.steps[1].rows).toHaveLength(1);
    expect(hurt.steps[1].rows[0].value.normal).toBe(Math.floor(131 * 7));
  });

  it('Aversión compara con los PV que le quedan al objetivo', () => {
    // El mob empieza con 1000 y el golpe previo lo deja a 0: tiene menos % de PV que el Sacrogrito (50 %).
    const input = fixture({ mobHp: 1000 });
    const r = run([hp(60), cast(BLOOD_BURN), cast(AVERSION)], input);
    expect(r.steps[1].state.mobHp).toBeLessThan(600);
    expect(r.steps[2].rows[0].value.normal).toBe(Math.floor(98 * 7));
  });
});

describe('Sacrogrito: Corazón de Sacrogrito', () => {
  const heart = (passives: string[], over: Partial<SimActor> = {}) =>
    fixture({ actor: { passives, stats: { mastMelee: 100, mastDist: 50, mastBerserk: 0, crit: 0 }, ...over } });

  it('en berserker suma la distancia a la melé', () => {
    const r = run([hp(40), cast(PLAIN)], heart(["Sacrier's Heart"]));
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(105 * 7.5));  // 150 + 500
    expect(run([hp(40), cast(PLAIN)], heart([])).steps[1].rows[0].value.normal).toBe(CALM);
  });

  it('en berserker suma la melé a la distancia', () => {
    const far = { mobCell: { x: 8, y: 5 } };
    const withHeart = fixture({ ...far, actor: heart(["Sacrier's Heart"]).actors[0] });
    const without = fixture({ ...far, actor: heart([]).actors[0] });
    const r = run([hp(40), cast(PLAIN)], withHeart);
    expect(r.steps[1].rows[0].tags).toContain('sim.tag.dist');
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(105 * 7.5));
    expect(run([hp(40), cast(PLAIN)], without).steps[1].rows[0].value.normal).toBe(Math.floor(105 * 6.5));
  });

  it('fuera de berserker no suma', () => {
    const r = run([cast(PLAIN)], heart(["Sacrier's Heart"]));
    expect(r.steps[0].rows[0].value.normal).toBe(CALM);
  });
});

describe('registro', () => {
  it('las reglas están registradas para el Sacrogrito', () => {
    expect(CLASS_RULES.sacrogrito).toBe(sacrierRules);
  });
});
