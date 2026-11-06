import { describe, expect, it } from 'vitest';
import type { Spell, SpellCast, SpellLine } from '../../spells';
import { simulate, type SimActor, type SimInput, type SimStep } from '../engine';
import { COMBOS, matchCombo } from './iop';

const CONC = '3442';
const PREP = '3462';

const dmg = (): SpellLine => ({ kind: 'damage', side: 'enemy', min: 50, max: 105, critMin: 60, critMax: 132 });

type Cost = Pick<SpellCast, 'ap' | 'mp' | 'wp'>;
// Hechizos de prueba: uno por tipo de coste, sin daño (id 1..6) y con daño (id 11..16).
const costs: Record<string, Cost> = {
  ap1: { ap: 1, mp: 0, wp: 0 }, ap2: { ap: 2, mp: 0, wp: 0 }, ap3: { ap: 3, mp: 0, wp: 0 },
  mp1: { ap: 0, mp: 1, wp: 0 }, wp1: { ap: 0, mp: 0, wp: 1 }, mixed: { ap: 1, mp: 1, wp: 0 },
};
const names = Object.keys(costs);
const plain = (c: string) => names.indexOf(c) + 1;
const withDamage = (c: string) => 10 + plain(c);
const BIG = 100;

function spell(id: number, c: Cost, over: Partial<SpellCast> = {}): Spell {
  return {
    id, name: `S${id}`, el: 'air', lvl: 0, icon: 0, text: [],
    cast: {
      key: `S${id}`, ...c, rangeMin: 1, rangeMax: 2, rangeMod: false, los: true, perTurn: null, target: 'st',
      lines: [], conditional: [], stateGains: [], reasons: [], partial: false, ...over,
    },
  };
}

function fixture(over: { actor?: Partial<SimActor>; spells?: Spell[]; extra?: number } = {}): SimInput {
  const spells = [
    ...names.map((c) => spell(plain(c), costs[c])),
    ...names.map((c) => spell(withDamage(c), costs[c], { lines: [dmg()] })),
    ...(over.spells ?? []),
  ];
  const main: SimActor = {
    id: 'main', name: 'Yo', classId: 'yopuka', level: 245,
    stats: { mastMelee: 100, mastDist: 0, mastBack: 200, mastCrit: 100, dmgPct: 0, crit: 0 },
    mastery: { fire: 0, water: 0, earth: 0, air: 500 }, maxHp: 1000, ap: 20, mp: 10, wp: 5, spells,
    start: { x: 5, y: 5 }, ...over.actor,
  };
  return {
    actors: [main],
    target: { name: 'Mob', hp: 1e6, res: { fire: 0, water: 0, earth: 0, air: 0 }, resBack: 0, resCrit: 0, cell: { x: 6, y: 5 }, facing: 'w' },
    steps: [], comboExtraPct: over.extra ?? 0,
  };
}

const cast = (id: number): SimStep => ({ type: 'cast', actor: 'main', spell: id, target: 'mob' });
// Secuencia de costes; el último lleva daño salvo que se diga lo contrario.
const seq = (cs: string[], lastDamage = true): SimStep[] =>
  cs.map((c, i) => cast(lastDamage && i === cs.length - 1 ? withDamage(c) : plain(c)));

const NORMAL = 735;  // 105 × (1 + 600 / 100)

describe('matchCombo', () => {
  it('reconoce los cinco combos por el final del historial', () => {
    expect(matchCombo(['ap2', 'ap1', 'mp1'])).toBe('extra');
    expect(matchCombo(['mp1', 'ap3', 'ap3'])).toBe('healSteal');
    expect(matchCombo(['ap1', 'ap1', 'ap2'])).toBe('push');
    expect(matchCombo(['mp1', 'mp1', 'wp1'])).toBe('prep');
    expect(matchCombo(['wp1', 'ap3', 'wp1', 'ap1'])).toBe('ap');
    expect(Object.keys(COMBOS)).toHaveLength(5);
  });
  it('solo cuenta el final', () => {
    expect(matchCombo(['ap3', 'ap2', 'ap1', 'mp1'])).toBe('extra');
    expect(matchCombo(['ap2', 'ap1', 'mp1', 'ap3'])).toBeNull();
  });
  it('devuelve null sin combo', () => {
    expect(matchCombo(['ap1', 'ap2'])).toBeNull();
    expect(matchCombo([])).toBeNull();
  });
});

describe('Yopuka: Concentración', () => {
  it('el combo suma 5 de Concentración', () => {
    const r = simulate({ ...fixture(), steps: seq(['mp1', 'mp1', 'wp1'], false) });
    expect(r.steps[2].state.actors.main!.states[CONC]).toBe(5);
    expect(r.steps[1].state.actors.main!.states[CONC] ?? 0).toBe(0);
  });

  it('Disipación anula esa Concentración', () => {
    const r = simulate({ ...fixture({ actor: { passives: ['Dissipation'] } }), steps: seq(['mp1', 'mp1', 'wp1'], false) });
    expect(r.steps[2].state.actors.main!.states[CONC] ?? 0).toBe(0);
  });

  it('cada hechizo suma la Concentración de su ficha', () => {
    const input = fixture({ spells: [spell(BIG, costs.ap1, { stateGains: [{ state: 3442, levels: 25 }, { state: 999, levels: 7 }] })] });
    const r = simulate({ ...input, steps: [cast(BIG), cast(BIG)] });
    expect(r.steps[1].state.actors.main!.states[CONC]).toBe(50);
    expect(r.steps[1].state.actors.main!.states['999']).toBeUndefined();
  });

  it('a 100 de Concentración da 1 PW, 4 de Preparación y resta 100', () => {
    const input = fixture({ spells: [spell(BIG, costs.ap1, { stateGains: [{ state: 3442, levels: 130 }] })] });
    const s = simulate({ ...input, steps: [{ type: 'adjust', wp: 2 }, cast(BIG)] }).steps[1].state.actors.main!;
    expect(s.wp).toBe(3);
    expect(s.states[PREP]).toBe(4);
    expect(s.states[CONC]).toBe(30);
  });

  it('respeta el tope de 400 de Concentración', () => {
    const input = fixture({ spells: [spell(BIG, costs.ap1, { stateGains: [{ state: 3442, levels: 900 }] })] });
    const s = simulate({ ...input, steps: [{ type: 'adjust', wp: 0 }, cast(BIG)] }).steps[1].state.actors.main!;
    // 900 se topa en 400: cuatro eventos de 100
    expect(s.wp).toBe(4);
    expect(s.states[PREP]).toBe(16);
    expect(s.states[CONC]).toBe(0);
  });
});

describe('Yopuka: Preparación', () => {
  it('el combo de preparación da 20 niveles', () => {
    const r = simulate({ ...fixture(), steps: seq(['mp1', 'mp1', 'wp1'], false) });
    expect(r.steps[2].state.actors.main!.states[PREP]).toBe(20);
  });

  it('la Preparación se gasta en el siguiente hechizo de daño', () => {
    const steps = [...seq(['mp1', 'mp1', 'wp1'], false), cast(withDamage('ap1')), cast(withDamage('ap1'))];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[3].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.2));
    expect(r.steps[3].rows[0].tags).toContain('sim.tag.preparation');
    expect(r.steps[3].state.actors.main!.states[PREP]).toBe(0);
    expect(r.steps[4].rows[0].value.normal).toBe(NORMAL);
    expect(r.steps[4].rows[0].tags).not.toContain('sim.tag.preparation');
  });

  it('un hechizo sin daño no gasta la Preparación', () => {
    const r = simulate({ ...fixture(), steps: [...seq(['mp1', 'mp1', 'wp1'], false), cast(plain('ap1'))] });
    expect(r.steps[3].state.actors.main!.states[PREP]).toBe(20);
  });

  it('un hechizo de daño lanzado a un aliado conserva la Preparación', () => {
    const input = fixture({ spells: [spell(BIG, costs.ap1, { lines: [dmg()], rangeMin: 0 })] });
    input.actors.push({ ...input.actors[0], id: 'ally', name: 'Aliado', start: { x: 4, y: 5 }, spells: [] });
    const steps: SimStep[] = [...seq(['mp1', 'mp1', 'wp1'], false), { type: 'cast', actor: 'main', spell: BIG, target: 'ally' }];
    const s = simulate({ ...input, steps }).steps[3];
    expect(s.state.actors.main!.states[PREP]).toBe(20);
    expect(s.rows[0]?.tags ?? []).not.toContain('sim.tag.preparation');
  });

  it('la Concentración del combo que cruza 100 en un hechizo de daño deja la Preparación para el siguiente', () => {
    const input = fixture({ spells: [spell(BIG, costs.ap3, { lines: [dmg()], stateGains: [{ state: 3442, levels: 96 }] })] });
    const steps = [cast(plain('mp1')), cast(plain('ap3')), cast(BIG), cast(withDamage('ap1'))];
    const r = simulate({ ...input, steps });
    const s = r.steps[2].state.actors.main!;
    expect(s.wp).toBe(5);  // ya estaba al máximo
    expect(s.states[PREP]).toBe(4);
    expect(s.states[CONC]).toBe(1);
    expect(r.steps[2].rows[0].tags).not.toContain('sim.tag.preparation');
    expect(r.steps[3].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.04));
  });

  it('se limita a 60 niveles', () => {
    const three = seq(['mp1', 'mp1', 'wp1'], false);
    const input = fixture({ actor: { wp: 10, mp: 20 } });
    const r = simulate({ ...input, steps: [...three, ...three, ...three, ...three, cast(withDamage('ap1'))] });
    expect(r.steps[11].state.actors.main!.states[PREP]).toBe(60);
    expect(r.steps[12].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.6));
  });
});

describe('Yopuka: efectos de los combos sobre el último hechizo', () => {
  it('el combo de daño extra aplica comboExtraPct y etiqueta sin confirmar', () => {
    const r = simulate({ ...fixture({ extra: 10 }), steps: seq(['ap2', 'ap1', 'mp1']) });
    const row = r.steps[2].rows[0];
    expect(row.value.normal).toBe(Math.floor(105 * 7 * 1.1));
    expect(row.tags).toContain('sim.tag.unconfirmed');
    expect(row.tags).toContain('sim.tag.combo');
  });

  it('con 0 % también marca sin confirmar y no toca los demás golpes', () => {
    const steps = [cast(withDamage('ap2')), ...seq(['ap2', 'ap1', 'mp1'])];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[3].rows[0].tags).toContain('sim.tag.unconfirmed');
    expect(r.steps[3].rows[0].value.normal).toBe(NORMAL);
    expect(r.steps[0].rows[0].tags).not.toContain('sim.tag.unconfirmed');
  });

  it('el comboExtraPct no se aplica fuera del combo', () => {
    const r = simulate({ ...fixture({ extra: 10 }), steps: [cast(withDamage('ap1'))] });
    expect(r.steps[0].rows[0].value.normal).toBe(NORMAL);
  });

  it('el robo de vida muestra una cura del lanzador del 150 % del daño', () => {
    const steps: SimStep[] = [{ type: 'adjust', hpPct: 10 }, ...seq(['mp1', 'ap3', 'ap3'])];
    const r = simulate({ ...fixture({ actor: { maxHp: 5000 } }), steps });
    const rows = r.steps[3].rows;
    expect(rows.map((x) => x.kind)).toEqual(['damage', 'heal']);
    expect(rows[1].raw!.normal).toBe(Math.floor(NORMAL * 1.5));
    expect(rows[1].value.normal).toBe(Math.floor(NORMAL * 1.5));
    expect(rows[1].tags).toContain('sim.tag.lifesteal');
    expect(r.steps[3].state.actors.main!.hp).toBe(500 + rows[1].value.avg);
    expect(r.totals.main!.heal.avg).toBe(rows[1].value.avg);
  });

  it('la cura del robo de vida se limita a los PV que faltan y conserva el bruto', () => {
    const steps: SimStep[] = [{ type: 'adjust', hpPct: 99.5 }, ...seq(['mp1', 'ap3', 'ap3'])];
    const heal = simulate({ ...fixture(), steps }).steps[3].rows[1];
    expect(heal.value).toEqual({ normal: 5, crit: 5, avg: 5 });
    expect(heal.raw!.normal).toBe(Math.floor(NORMAL * 1.5));
  });

  it('el empuje etiqueta y avisa de que no se calcula la colisión', () => {
    const r = simulate({ ...fixture(), steps: seq(['ap1', 'ap1', 'ap2']) });
    const row = r.steps[2].rows[0];
    expect(row.tags).toContain('sim.tag.push');
    expect(row.warnings).toContain('sim.warn.collision');
    expect(row.value.normal).toBe(NORMAL);
  });

  it('el combo de PA da 2 PA al lanzador', () => {
    const r = simulate({ ...fixture({ actor: { ap: 10 } }), steps: seq(['wp1', 'ap3', 'wp1', 'ap1']) });
    // gasta 3 + 1 PA y recupera 2
    expect(r.steps[3].state.actors.main!.ap).toBe(10 - 4 + 2);
  });
});

describe('Yopuka: historial de costes', () => {
  it('un hechizo con dos tipos de coste no cuenta como paso', () => {
    const steps = [cast(plain('mixed')), cast(plain('ap3')), cast(withDamage('ap3'))];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[2].rows.map((x) => x.kind)).toEqual(['damage']);
    expect(r.steps[2].state.actors.main!.states[CONC] ?? 0).toBe(0);
  });

  it('un coste de 4 PA no es paso y rompe la secuencia', () => {
    const input = fixture({ spells: [spell(BIG, { ap: 4, mp: 0, wp: 0 }, { lines: [dmg()] })] });
    const r = simulate({ ...input, steps: [cast(plain('mp1')), cast(BIG), cast(plain('ap3')), cast(withDamage('ap3'))] });
    expect(r.steps[3].rows.map((x) => x.kind)).toEqual(['damage']);
  });

  it('un hechizo de dos tipos de coste entre medias rompe la secuencia', () => {
    const steps = [cast(plain('mp1')), cast(plain('mixed')), cast(plain('ap3')), cast(withDamage('ap3'))];
    expect(simulate({ ...fixture(), steps }).steps[3].rows.map((x) => x.kind)).toEqual(['damage']);
  });

  it('un hechizo sin ficha rompe la secuencia', () => {
    const noData: Spell = { id: BIG, name: 'Sin datos', el: 'air', lvl: 0, icon: 0, text: [] };
    const steps = [cast(plain('mp1')), cast(plain('ap3')), cast(BIG), cast(withDamage('ap3'))];
    const r = simulate({ ...fixture({ spells: [noData] }), steps });
    expect(r.steps[3].rows.map((x) => x.kind)).toEqual(['damage']);
  });

  it('un combo completado consume sus pasos: no encadena con el siguiente', () => {
    const steps = ['ap1', 'ap1', 'ap2', 'ap1', 'mp1'].map((c) => cast(withDamage(c)));
    const r = simulate({ ...fixture({ extra: 10 }), steps });
    expect(r.steps[2].rows[0].tags).toContain('sim.tag.push');
    expect(r.steps[4].rows[0].tags).not.toContain('sim.tag.unconfirmed');
    expect(r.steps[4].state.actors.main!.states[CONC]).toBe(5);
  });

  it('el historial se reinicia al terminar el turno', () => {
    const steps: SimStep[] = [cast(plain('mp1')), cast(plain('ap3')), { type: 'endTurn' }, cast(withDamage('ap3'))];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[3].rows.map((x) => x.kind)).toEqual(['damage']);
  });

  it('andar no cuenta como paso del combo', () => {
    const steps: SimStep[] = [cast(plain('mp1')), cast(plain('ap3')), { type: 'move', actor: 'main', to: { x: 4, y: 5 } }, cast(withDamage('ap3'))];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[3].rows.map((x) => x.kind)).toEqual(['damage', 'heal']);
  });

  it('un paso rechazado no entra en el historial', () => {
    const steps: SimStep[] = [cast(plain('mp1')), cast(plain('ap3')), cast(withDamage('wp1')), cast(withDamage('ap3'))];
    const r = simulate({ ...fixture({ actor: { wp: 0 } }), steps });
    expect(r.steps[2].ok).toBe(false);
    expect(r.steps[3].rows.map((x) => x.kind)).toEqual(['damage', 'heal']);
  });
});

describe('Yopuka: hechizos condicionales', () => {
  it('una condición que no es la de 100 de Concentración sigue avisada', () => {
    const input = fixture({
      spells: [spell(BIG, costs.ap3, {
        lines: [dmg()], reasons: ['conditional', 'secondary'],
        conditional: [{ when: 'If this spell kills a fighter', lines: [dmg()] }],
        stateGains: [{ state: 3442, levels: 100 }],
      })],
    });
    const row = simulate({ ...input, steps: [cast(BIG)] }).steps[0].rows[0];
    expect(row.warnings).toContain('sim.warn.conditional');
    expect(row.value.normal).toBe(NORMAL);
  });
});

describe('Yopuka: Preparación ajustada a mano', () => {
  it('la Preparación fijada con un ajuste sube el daño del siguiente hechizo y se gasta', () => {
    const steps: SimStep[] = [
      { type: 'adjust', state: { id: PREP, levels: 20 } }, cast(withDamage('ap1')), cast(withDamage('ap1')),
    ];
    const r = simulate({ ...fixture(), steps });
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.2));
    expect(r.steps[1].rows[0].tags).toContain('sim.tag.preparation');
    expect(r.steps[2].rows[0].value.normal).toBe(NORMAL);
  });
});

describe('Yopuka: Juicio', () => {
  const judgment = (over: Partial<SpellCast> = {}) => spell(BIG, costs.ap1, {
    key: 'Judgment', reasons: ['conditional'],
    conditional: [{ when: 'Cast on an enemy', lines: [dmg()] }, { when: 'Cast on an ally', lines: [] }],
    stateGains: [{ state: 3442, levels: 5 }], ...over,
  });
  const allyActor = (input: SimInput): SimActor => ({ ...input.actors[0], id: 'ally', start: { x: 5, y: 4 } });
  const on = (target: 'mob' | 'ally' | 'self'): SimStep => ({ type: 'cast', actor: 'main', spell: BIG, target });

  it('sobre el mob hace su daño, sin el aviso condicional', () => {
    const r = simulate({ ...fixture({ spells: [judgment()] }), steps: [on('mob')] });
    const row = r.steps[0].rows[0];
    expect(row.uncalculated).toBeUndefined();
    expect(row.value.normal).toBe(NORMAL);
    expect(row.warnings).not.toContain('sim.warn.conditional');
    expect(row.warnings).toContain('sim.warn.secondary');  // el estado que deja en el mob no se calcula
    expect(r.steps[0].state.actors.main!.states[CONC]).toBe(5);
  });

  it('sobre el mob gasta la Preparación y la aprovecha', () => {
    const steps: SimStep[] = [{ type: 'adjust', state: { id: PREP, levels: 20 } }, on('mob')];
    const r = simulate({ ...fixture({ spells: [judgment()] }), steps });
    expect(r.steps[1].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.2));
    expect(r.steps[1].state.actors.main!.states[PREP]).toBe(0);
  });

  it('sobre un aliado le da 10 de Preparación y 5 de Concentración al lanzador, y lo dice en su fila', () => {
    const input = fixture({ spells: [judgment()] });
    const r = simulate({ ...input, actors: [input.actors[0], allyActor(input)], steps: [on('ally')] });
    const after = r.steps[0].state.actors;
    expect(after.ally!.states[PREP]).toBe(10);
    expect(after.main!.states[PREP] ?? 0).toBe(0);
    expect(after.main!.states[CONC]).toBe(5);
    expect(r.steps[0].rows).toEqual([expect.objectContaining({ uncalculated: true, warnings: ['sim.warn.prepGiven'] })]);
    expect(r.totals.main!.damage.normal).toBe(0);
  });

  it('sobre un aliado no gasta la Preparación del lanzador', () => {
    const input = fixture({ spells: [judgment()] });
    const steps: SimStep[] = [{ type: 'adjust', state: { id: PREP, levels: 20 } }, on('ally')];
    const r = simulate({ ...input, actors: [input.actors[0], allyActor(input)], steps });
    expect(r.steps[1].state.actors.main!.states[PREP]).toBe(20);
  });
});

describe('Yopuka: etiquetas de combo', () => {
  it('el combo de Preparación se indica en la fila', () => {
    const r = simulate({ ...fixture(), steps: seq(['mp1', 'mp1', 'wp1']) });
    expect(r.steps[2].rows[0].tags).toContain('sim.tag.comboPrep');
  });

  it('el combo de PA se indica en la fila', () => {
    const r = simulate({ ...fixture(), steps: seq(['wp1', 'ap3', 'wp1', 'ap1']) });
    expect(r.steps[3].rows[0].tags).toContain('sim.tag.comboAp');
  });
});

describe('Yopuka: PW de la Concentración', () => {
  const gain100 = () => fixture({ spells: [spell(BIG, costs.ap1, { stateGains: [{ state: 3442, levels: 100 }] })] });

  it('un evento con los PW al máximo los deja en el máximo', () => {
    const s = simulate({ ...gain100(), steps: [cast(BIG)] }).steps[0].state.actors.main!;
    expect(s.wp).toBe(5);
    expect(s.states[PREP]).toBe(4);
  });

  it('Alarde: el evento no da PW pero conserva la Preparación', () => {
    const input = gain100();
    input.actors[0].passives = ['Show Off'];
    const s = simulate({ ...input, steps: [{ type: 'adjust', wp: 2 }, cast(BIG)] }).steps[1].state.actors.main!;
    expect(s.wp).toBe(2);
    expect(s.states[PREP]).toBe(4);
    expect(s.states[CONC]).toBe(0);
  });
});

describe('Yopuka: golpe adicional a 100 de Concentración', () => {
  const WHEN = 'When the Iop reaches 100 state 3442';
  const HIT_N = 385;  // 55 × (1 + 600 / 100)
  const extraLine = (over: Partial<SpellLine> = {}): SpellLine =>
    ({ kind: 'damage', side: 'enemy', min: 2, max: 55, critMin: 2, critMax: 55, noCrit: true, ...over });
  // Trueno y Ira de Yopuka de prueba: con rama condicional de 100 de Concentración.
  const THUNDER = 31, WRATH = 32, FILL = 33, ALLY_ONLY = 34;
  const withBranch = (id: number, key: string, gain: number, line = extraLine(), over: Partial<SpellCast> = {}) =>
    spell(id, costs.ap1, {
      key, lines: [dmg()], conditional: [{ when: WHEN, lines: [line] }], stateGains: [{ state: 3442, levels: gain }],
      reasons: ['conditional'], ...over,
    });
  const build = (gainT = 15, gainW = 40) => fixture({
    spells: [
      withBranch(THUNDER, 'Thunderbolt', gainT), withBranch(WRATH, "Iop's Wrath", gainW, extraLine({ min: 3, max: 91, critMin: 4, critMax: 114, noCrit: false })),
      spell(FILL, costs.ap1, { stateGains: [{ state: 3442, levels: 100 }] }),
      withBranch(ALLY_ONLY, 'Thunderbolt', 15, extraLine(), { rangeMin: 0 }),
    ],
  });
  const withAlly = (input: SimInput): SimInput => {
    input.actors.push({ ...input.actors[0], id: 'ally', name: 'Aliado', start: { x: 4, y: 5 }, spells: [] });
    return input;
  };
  const extraRows = (r: ReturnType<typeof simulate>, i: number) => r.steps[i].rows.filter((x) => x.tags.includes('sim.tag.delayedHit'));

  it('se dispara en el paso que cruza 100 y desaparece', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER), cast(FILL), cast(FILL)] });
    expect(extraRows(r, 0)).toHaveLength(0);
    const rows = r.steps[1].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('damage');
    expect(rows[0].value).toEqual({ normal: HIT_N, crit: HIT_N, avg: HIT_N });
    expect(rows[0].tags).toEqual(expect.arrayContaining(['sim.tag.delayedHit', 'sim.tag.unconfirmed']));
    expect(r.steps[1].state.actors.main!.pending).toEqual({});
    expect(r.steps[2].rows).toHaveLength(0);
  });

  it('la propia ganancia que cruza 100 lo dispara en ese paso, tras el golpe principal', () => {
    const r = simulate({ ...build(100), steps: [cast(THUNDER)] });
    const rows = r.steps[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].value.normal).toBe(NORMAL);
    expect(rows[1].tags).toContain('sim.tag.delayedHit');
    expect(rows[1].value.normal).toBe(HIT_N);
  });

  it('el +5 del combo que cruza 100 también lo dispara', () => {
    const steps = [cast(THUNDER), ...seq(['mp1', 'mp1', 'wp1'], false)];
    const input = build();
    const r = simulate({ ...input, steps: [{ type: 'adjust', state: { id: CONC, levels: 80 } }, ...steps] });
    // 80 + 15 del Trueno = 95; el combo suma 5 y llega a 100
    expect(extraRows(r, 3)).toHaveLength(0);
    expect(extraRows(r, 4)).toHaveLength(1);
  });

  it('Ira de Yopuka y Trueno pendientes dan dos filas', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER), cast(WRATH), cast(FILL)] });
    const rows = extraRows(r, 2);
    expect(rows).toHaveLength(2);
    expect(rows.map((x) => x.value.normal).sort((a, b) => a - b)).toEqual([HIT_N, Math.floor(91 * 7)]);
  });

  it('repetir el hechizo sustituye su golpe pendiente', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER), cast(THUNDER), cast(FILL)] });
    expect(extraRows(r, 2)).toHaveLength(1);
  });

  it('lanzado a un aliado no guarda nada', () => {
    const input = withAlly(build());
    const r = simulate({
      ...input, steps: [{ type: 'cast', actor: 'main', spell: ALLY_ONLY, target: 'ally' }, cast(FILL)],
    });
    expect(r.steps[0].state.actors.main!.pending ?? {}).toEqual({});
    expect(extraRows(r, 1)).toHaveLength(0);
  });

  it('suma a los totales y baja los PV del mob', () => {
    const input = build();
    const r = simulate({ ...input, steps: [cast(THUNDER), cast(FILL)] });
    expect(r.totals.main!.damage.normal).toBe(NORMAL + HIT_N);
    expect(r.steps[1].state.mobHp).toBe(input.target.hp - (r.steps[0].rows[0].value.avg + HIT_N));
  });

  it('el golpe pendiente sobrevive al fin de turno', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER), { type: 'endTurn' }, cast(FILL)] });
    expect(extraRows(r, 2)).toHaveLength(1);
  });

  it('ajustar la Concentración a mano no lo dispara', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER), { type: 'adjust', state: { id: CONC, levels: 100 } }] });
    expect(r.steps[1].rows).toHaveLength(0);
    expect(r.steps[1].state.actors.main!.pending?.Thunderbolt).toBeDefined();
  });

  it('la rama resuelta no deja el aviso de condicional', () => {
    const r = simulate({ ...build(), steps: [cast(THUNDER)] });
    expect(r.steps[0].rows[0].warnings).not.toContain('sim.warn.conditional');
  });

  it('otra clase con la misma rama no guarda nada', () => {
    const input = build();
    input.actors[0].classId = 'sacrogrito';
    const r = simulate({ ...input, steps: [cast(THUNDER), cast(FILL)] });
    expect(r.steps[1].rows).toHaveLength(0);
    expect(r.steps[0].rows[0].warnings).toContain('sim.warn.conditional');
  });
});
