import { describe, expect, it } from 'vitest';
import type { Spell, SpellCast, SpellLine } from '../spells';
import { CLASS_RULES, simulate, type SimActor, type SimInput, type SimStep, type SimTarget } from './engine';

const line = (over: Partial<SpellLine> = {}): SpellLine => ({
  kind: 'damage', side: 'enemy', min: 50, max: 105, critMin: 60, critMax: 132, ...over,
});

const castOf = (over: Partial<SpellCast> = {}): SpellCast => ({
  key: 'Jabs', ap: 3, mp: 0, wp: 0, rangeMin: 1, rangeMax: 2, rangeMod: false, los: true,
  perTurn: 2, target: 'st', lines: [line()], conditional: [], stateGains: [], reasons: [], partial: false, ...over,
});

const spellOf = (id: number, over: Partial<Spell> = {}, cast: Partial<SpellCast> | null = {}): Spell => ({
  id, name: `Hechizo ${id}`, el: 'air', lvl: 0, icon: 0, text: [], ...(cast ? { cast: castOf(cast) } : {}), ...over,
});

const JABS = 1;

function fixture(over: { actor?: Partial<SimActor>; target?: Partial<SimTarget>; steps?: SimStep[]; spells?: Spell[] } = {}): SimInput {
  const main: SimActor = {
    id: 'main', name: 'Yo', classId: 'test', level: 245,
    stats: { mastMelee: 100, mastDist: 0, mastBack: 200, mastCrit: 100, dmgPct: 0, crit: 20 },
    mastery: { fire: 0, water: 0, earth: 0, air: 500 }, maxHp: 1000, ap: 6, mp: 4, wp: 6,
    spells: over.spells ?? [spellOf(JABS)], start: { x: 5, y: 5 }, ...over.actor,
  };
  const target: SimTarget = {
    name: 'Mob', hp: 100000, res: { fire: 0, water: 0, earth: 0, air: 0 }, resBack: 0, resCrit: 0,
    cell: { x: 6, y: 5 }, facing: 'w', ...over.target,
  };
  return { actors: [main], target, steps: over.steps ?? [], comboExtraPct: 0 };
}

const jab = (n = 1): SimStep[] => Array.from({ length: n }, () => ({ type: 'cast', actor: 'main', spell: JABS, target: 'mob' }));
const castAt = (spell: number, target: 'mob' | 'ally' | 'self', actor: 'main' | 'ally' = 'main'): SimStep =>
  ({ type: 'cast', actor, spell, target });

describe('simulate: daño', () => {
  it('calcula un golpe de frente', () => {
    const r = simulate({ ...fixture(), steps: jab() });
    const row = r.steps[0].rows[0];
    expect(r.steps[0].ok).toBe(true);
    expect(row.kind).toBe('damage');
    expect(row.value).toEqual({ normal: 735, crit: 1056, avg: 799 });
    expect(row.position).toBe('front');
  });

  it('sube el daño por la espalda', () => {
    const r = simulate({ ...fixture({ target: { facing: 'e' } }), steps: jab() });
    expect(r.steps[0].rows[0].value.normal).toBe(1181);
    expect(r.steps[0].rows[0].position).toBe('back');
  });

  it('usa la resistencia del elemento, la de espalda y la de crítico', () => {
    const r = simulate({
      ...fixture({ target: { facing: 'e', res: { fire: 0, water: 0, earth: 0, air: 100 }, resBack: 100, resCrit: 100 } }),
      steps: jab(),
    });
    // normal: res 200 -> 36 %: 105 × 9 × 1,25 × 0,64; crítico: res 300 -> 48,8 %: 132 × 10 × 1,25 × 0,512
    expect(r.steps[0].rows[0].value).toMatchObject({ normal: 756, crit: 844 });
  });

  it('la maestría de distancia sustituye a la de melé a 3 o más casillas', () => {
    const input = fixture({
      actor: { stats: { mastMelee: 100, mastDist: 300, crit: 0 }, start: { x: 3, y: 5 } },
      spells: [spellOf(JABS, {}, { rangeMax: 5 })],
    });
    const r = simulate({ ...input, steps: jab() });
    expect(r.steps[0].rows[0].value.normal).toBe(105 * 9);
  });

  it('el elemento luz usa la maestría elemental más alta', () => {
    const input = fixture({ spells: [spellOf(JABS, { el: 'light' })] });
    input.actors[0].mastery = { fire: 0, water: 700, earth: 0, air: 500 };
    const r = simulate({ ...input, steps: jab() });
    expect(r.steps[0].rows[0].value.normal).toBe(105 * 9);
    expect(r.steps[0].rows[0].warnings).toEqual([]);
  });

  it('el elemento neutro avisa de que usa la maestría más alta', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(JABS, { el: 'neutral' })] }), steps: jab() });
    expect(r.steps[0].rows[0].value.normal).toBe(735);
    expect(r.steps[0].rows[0].warnings).toEqual(['sim.warn.element']);
  });

  it('suma berserker con las líneas y la maestría de berserker', () => {
    const input = fixture({
      actor: { stats: { mastMelee: 100, mastBerserk: 100, crit: 0 } },
      spells: [spellOf(JABS, {}, { berserkLines: [line({ min: 10, max: 20, critMin: 10, critMax: 20 })] })],
    });
    const calm = simulate({ ...input, steps: jab() });
    expect(calm.steps[0].rows[0].value.normal).toBe(735);
    const hurt = simulate({ ...input, steps: [{ type: 'adjust', hpPct: 49 }, ...jab()] });
    expect(hurt.steps[1].rows[0].value.normal).toBe(20 * 8);
    expect(hurt.steps[1].rows[0].tags).toContain('sim.tag.berserk');
  });

  it('aplica el daño extra de las reglas de clase (no el comboExtraPct global)', () => {
    // el % de combo lo aplica la regla de clase solo en el último hechizo del combo
    const input = { ...fixture(), comboExtraPct: 10, steps: jab() };
    expect(simulate(input).steps[0].rows[0].value.normal).toBe(735);
    CLASS_RULES.test = { beforeCast: () => ({ dmgPct: 10, tags: ['sim.tag.combo'], warnings: ['sim.warn.secondary'] }) };
    try {
      const r = simulate({ ...fixture(), steps: jab() });
      expect(r.steps[0].rows[0].value.normal).toBe(Math.floor(105 * 7 * 1.1));
      expect(r.steps[0].rows[0].tags).toContain('sim.tag.combo');
      expect(r.steps[0].rows[0].warnings).toContain('sim.warn.secondary');
    } finally {
      delete CLASS_RULES.test;
    }
  });

  it('protege los datos: nivel, % de crítico y porcentajes absurdos', () => {
    const wild = fixture({ actor: { level: 9999, stats: { mastMelee: 100, crit: 500, dmgPct: -500 } } });
    wild.target.res.air = 100000;
    expect(simulate({ ...wild, steps: jab() }).steps[0].rows[0].value).toEqual({ normal: 0, crit: 0, avg: 0 });
    // nivel máximo y crítico al 100 %: la media es el crítico
    const maxed = fixture({ actor: { level: 9999, stats: { mastMelee: 100, mastCrit: 100, crit: 500 } } });
    const v = simulate({ ...maxed, steps: jab() }).steps[0].rows[0].value;
    expect(v).toEqual({ normal: 735, crit: 1056, avg: 1056 });
    const low = simulate({ ...fixture({ actor: { level: -3 } }), steps: jab() });
    expect(low.steps[0].rows[0].value.normal).toBe(50 * 7);
  });

  it('descuenta el daño medio de los PV del mob', () => {
    const r = simulate({ ...fixture(), steps: jab() });
    expect(r.steps[0].state.mobHp).toBe(100000 - 799);
  });
});

describe('simulate: validación y turnos', () => {
  it('no permite gastar más PA de los que hay', () => {
    const input = fixture({ spells: [spellOf(JABS, {}, { perTurn: null })] });
    const r = simulate({ ...input, steps: jab(3) });
    expect(r.steps[1].ok).toBe(true);
    expect(r.steps[2]).toMatchObject({ ok: false, reason: 'sim.err.ap', rows: [] });
    expect(r.totals.main!.damage.normal).toBe(735 * 2);
    expect(r.steps[2].state.actors.main!.ap).toBe(0);
  });

  it('respeta PM y PW de los hechizos', () => {
    const mp = fixture({ spells: [spellOf(JABS, {}, { mp: 5 })] });
    expect(simulate({ ...mp, steps: jab() }).steps[0].reason).toBe('sim.err.mp');
    const wp = fixture({ spells: [spellOf(JABS, {}, { wp: 7 })] });
    expect(simulate({ ...wp, steps: jab() }).steps[0].reason).toBe('sim.err.wp');
  });

  it('respeta usos por turno', () => {
    const r = simulate({ ...fixture({ actor: { ap: 8 } }), steps: jab(3) });
    expect(r.steps[2]).toMatchObject({ ok: false, reason: 'sim.err.uses' });
  });

  it('respeta el alcance', () => {
    const r = simulate({ ...fixture({ actor: { start: { x: 3, y: 5 } } }), steps: jab() });
    expect(r.steps[0]).toMatchObject({ ok: false, reason: 'sim.err.range' });
  });

  it('el alcance modificable suma el alcance del personaje', () => {
    const input = fixture({
      actor: { start: { x: 3, y: 5 }, stats: { range: 1 } },
      spells: [spellOf(JABS, {}, { rangeMod: true })],
    });
    expect(simulate({ ...input, steps: jab() }).steps[0].ok).toBe(true);
  });

  it('rechaza hechizos que el personaje no tiene y personajes ausentes', () => {
    const r = simulate({
      ...fixture(),
      steps: [castAt(99, 'mob'), castAt(JABS, 'ally'), castAt(JABS, 'mob', 'ally')],
    });
    expect(r.steps.map((s) => s.reason)).toEqual(['sim.err.spell', 'sim.err.target', 'sim.err.actor']);
  });

  it('fin de turno recupera recursos', () => {
    const r = simulate({ ...fixture(), steps: [...jab(2), { type: 'endTurn' }, ...jab()] });
    expect(r.steps[1].state.actors.main!.ap).toBe(0);
    expect(r.steps[2].state.actors.main).toMatchObject({ ap: 6, mp: 4, wp: 6, uses: {} });
    expect(r.steps[2].state.turn).toBe(2);
    expect(r.steps[3].ok).toBe(true);
  });

  it('mover gasta PM y actualiza la posición', () => {
    const r = simulate({ ...fixture(), steps: [{ type: 'move', actor: 'main', to: { x: 5, y: 8 } }] });
    expect(r.steps[0].ok).toBe(true);
    expect(r.steps[0].state.actors.main).toMatchObject({ cell: { x: 5, y: 8 }, mp: 1 });
  });

  it('no se puede mover a una casilla ocupada o fuera del mapa, ni sin PM', () => {
    const r = simulate({
      ...fixture(),
      steps: [
        { type: 'move', actor: 'main', to: { x: 6, y: 5 } },
        { type: 'move', actor: 'main', to: { x: -1, y: 5 } },
        { type: 'move', actor: 'main', to: { x: 11, y: 5 } },
        { type: 'move', actor: 'main', to: { x: 0, y: 0 } },
      ],
    });
    expect(r.steps.map((s) => s.reason)).toEqual(['sim.err.cell', 'sim.err.cell', 'sim.err.cell', 'sim.err.mp']);
    expect(r.steps[3].state.actors.main!.cell).toEqual({ x: 5, y: 5 });
  });

  it('marca sin borrar los pasos que dejan de ser válidos', () => {
    const input = fixture({ spells: [spellOf(JABS, {}, { perTurn: null })] });
    const before = simulate({ ...input, steps: jab(2) });
    expect(before.steps.every((s) => s.ok)).toBe(true);
    input.actors[0].ap = 2;
    const after = simulate({ ...input, steps: jab(2) });
    expect(after.steps).toHaveLength(2);
    expect(after.steps[0]).toMatchObject({ ok: false, reason: 'sim.err.ap' });
    expect(after.steps[1]).toMatchObject({ ok: false });
    expect(after.totals.main!.damage).toEqual({ normal: 0, crit: 0, avg: 0 });
  });

  it('devuelve estado inmutable por paso', () => {
    const r = simulate({ ...fixture(), steps: jab(2) });
    expect(r.steps[0].state).not.toBe(r.steps[1].state);
    expect(r.steps[0].state.actors.main!.ap).toBe(3);
    expect(r.steps[1].state.actors.main!.ap).toBe(0);
    expect(r.steps[0].state.actors.main!.uses[JABS]).toBe(1);
  });

  it('los ajustes cambian PV, armadura y orientación', () => {
    const r = simulate({
      ...fixture(),
      steps: [
        { type: 'adjust', hpPct: 40, armor: 9999, facing: 'e' },
        { type: 'adjust', actor: 'ally', hpPct: 10 },
      ],
    });
    expect(r.steps[0].state.actors.main).toMatchObject({ hp: 400, armor: 500 });
    expect(r.steps[0].state.facing).toBe('e');
    expect(r.steps[1]).toMatchObject({ ok: false, reason: 'sim.err.actor' });
  });
});

describe('simulate: avisos', () => {
  it('avisa cuando el hechizo es parcial o no tiene cast', () => {
    const input = fixture({
      spells: [
        spellOf(1, {}, { reasons: ['conditional', 'secondary', 'noCrit'], partial: true, perTurn: null }),
        spellOf(2, {}, null),
      ],
    });
    const r = simulate({ ...input, steps: [castAt(1, 'mob'), castAt(2, 'mob')] });
    expect(r.steps[0].rows[0].warnings).toEqual(['sim.warn.conditional', 'sim.warn.secondary', 'sim.warn.noCrit']);
    expect(r.steps[1].ok).toBe(true);
    expect(r.steps[1].rows).toEqual([
      expect.objectContaining({ uncalculated: true, warnings: ['sim.warn.noData'], value: { normal: 0, crit: 0, avg: 0 } }),
    ]);
    expect(r.totals.main!.damage.normal).toBe(735);
  });

  it('con solo efectos condicionales emite una fila sin calcular que no suma', () => {
    const input = fixture({
      spells: [spellOf(1, {}, { lines: [], conditional: [{ when: 'si X', lines: [line()] }], reasons: ['conditional'], partial: true })],
    });
    const r = simulate({ ...input, steps: [castAt(1, 'mob')] });
    expect(r.steps[0].ok).toBe(true);
    expect(r.steps[0].rows).toHaveLength(1);
    expect(r.steps[0].rows[0]).toMatchObject({ uncalculated: true, warnings: ['sim.warn.conditional'] });
    expect(r.steps[0].state.actors.main!.ap).toBe(3);
    expect(r.totals.main!.damage).toEqual({ normal: 0, crit: 0, avg: 0 });
  });

  it('una regla de clase puede aportar las líneas condicionales y quita su aviso', () => {
    const input = fixture({
      spells: [spellOf(1, {}, { lines: [], conditional: [{ when: 'si X', lines: [line()] }], reasons: ['conditional'], partial: true })],
    });
    CLASS_RULES.test = { beforeCast: () => ({ lines: [line()] }) };
    try {
      const r = simulate({ ...input, steps: [castAt(1, 'mob')] });
      expect(r.steps[0].rows[0].uncalculated).toBeUndefined();
      expect(r.steps[0].rows[0].value.normal).toBe(735);
      expect(r.steps[0].rows[0].warnings).toEqual([]);
    } finally {
      delete CLASS_RULES.test;
    }
  });
});

describe('simulate: apoyo', () => {
  const heal = (over: Partial<SpellLine> = {}) => line({ kind: 'heal', side: 'ally', min: 100, max: 200, critMin: 100, critMax: 250, ...over });
  const armor = (over: Partial<SpellLine> = {}) => line({ kind: 'armor', side: 'ally', min: 100, max: 200, critMin: 100, critMax: 250, ...over });

  const duo = (spells: Spell[]): SimInput => {
    const input = fixture({ spells, actor: { stats: { mastMelee: 100, mastHeal: 100, crit: 0, healPct: 10, armorGiven: 50 } } });
    input.actors.push({
      ...input.actors[0], id: 'ally', name: 'Aliado', start: { x: 4, y: 5 }, stats: { healReceived: 20, armorReceived: 10 },
      spells: [], maxHp: 1000,
    });
    return input;
  };

  it('limita la cura a los PV que faltan y conserva el bruto', () => {
    const input = duo([spellOf(1, {}, { lines: [heal()], perTurn: null })]);
    const r = simulate({
      ...input,
      steps: [{ type: 'adjust', actor: 'ally', hpPct: 98 }, castAt(1, 'ally')],
    });
    const row = r.steps[1].rows[0];
    // bruto: 200 × (1 + 700/100) × (1 + (10 + 20)/100) = 2080; faltan 20 PV
    expect(row.kind).toBe('heal');
    expect(row.raw!.normal).toBe(2080);
    expect(row.value.normal).toBe(20);
    expect(r.steps[1].state.actors.ally!.hp).toBe(1000);
    expect(r.totals.main!.heal.normal).toBe(20);
  });

  it('suma resistencia a curas con cada cura recibida', () => {
    const input = duo([spellOf(1, {}, { lines: [heal({ min: 50, max: 50, critMin: 50, critMax: 50 })], perTurn: null })]);
    const r = simulate({ ...input, steps: [{ type: 'adjust', actor: 'ally', hpPct: 10 }, castAt(1, 'ally'), castAt(1, 'ally')] });
    // primera: 50 × 8 × 1,3 = 520 -> +floor(520/1000 × 20) = 10; la segunda sale ×0,9
    expect(r.steps[1].state.actors.ally!.healRes).toBe(10);
    expect(r.steps[2].rows[0].raw!.normal).toBe(468);
  });

  it('aplica Incurable y Friable desde los estados', () => {
    const input = duo([spellOf(1, {}, {
      lines: [heal({ min: 100, max: 100 }), armor({ min: 100, max: 100 })], perTurn: null,
    })]);
    CLASS_RULES.test = { beforeCast: (s) => { s.states.incurable = 50; s.states.crumbly = 50; return {}; } };
    try {
      const r = simulate({ ...input, steps: [{ type: 'adjust', hpPct: 10 }, castAt(1, 'self')] });
      // cura: 100 × 8 × 1,1 × 0,5 = 440; armadura sobre uno mismo: 100 × 0,5 = 50
      expect(r.steps[1].rows.map((x) => [x.kind, x.raw!.normal])).toEqual([['heal', 440], ['armor', 50]]);
    } finally {
      delete CLASS_RULES.test;
    }
  });

  it('topa la armadura al 50 % de PV máximos', () => {
    const input = duo([spellOf(1, {}, { lines: [armor({ min: 200, max: 200, critMin: 200, critMax: 200 })], perTurn: null })]);
    const r = simulate({ ...input, steps: [castAt(1, 'ally'), castAt(1, 'ally')] });
    // 200 × (1 + 60/100) = 320 por lanzamiento; el segundo solo cabe en 180
    expect(r.steps[0].state.actors.ally!.armor).toBe(320);
    expect(r.steps[1].state.actors.ally!.armor).toBe(500);
    expect(r.steps[1].rows[0].value.normal).toBe(180);
    expect(r.steps[1].rows[0].raw!.normal).toBe(320);
  });

  it('aplica % armadura dada solo a aliados', () => {
    const input = duo([spellOf(1, {}, { lines: [armor({ min: 100, max: 100 })], perTurn: null })]);
    const ally = simulate({ ...input, steps: [castAt(1, 'ally')] });
    expect(ally.steps[0].rows[0].raw!.normal).toBe(Math.floor(100 * (1 + (50 + 10) / 100)));
    const self = simulate({ ...input, steps: [castAt(1, 'self')] });
    expect(self.steps[0].rows[0].raw!.normal).toBe(100);
  });

  it('las líneas del lanzador siempre van al lanzador', () => {
    const input = duo([spellOf(1, {}, { lines: [armor({ side: 'caster', min: 100, max: 100 })], perTurn: null })]);
    const r = simulate({ ...input, steps: [castAt(1, 'mob')] });
    expect(r.steps[0].rows[0].raw!.normal).toBe(100);
    expect(r.steps[0].state.actors.main!.armor).toBe(100);
    expect(r.steps[0].state.actors.ally!.armor).toBe(0);
  });

  it('las líneas enemigas no se aplican sobre un aliado y las aliadas no sobre el mob', () => {
    const input = duo([
      spellOf(1, {}, { lines: [line()], perTurn: null }),
      spellOf(2, {}, { lines: [heal()], perTurn: null }),
    ]);
    const r = simulate({ ...input, steps: [castAt(1, 'ally'), castAt(2, 'mob')] });
    for (const step of r.steps) {
      expect(step.rows).toEqual([expect.objectContaining({ uncalculated: true, warnings: ['sim.warn.targetDropped'] })]);
    }
  });

  it('el aliado actúa con sus propios recursos y baraja', () => {
    const input = duo([]);
    input.actors[1].spells = [spellOf(1, {}, { perTurn: null })];
    input.actors[1].ap = 3;
    const r = simulate({ ...input, steps: [castAt(1, 'mob', 'ally'), castAt(1, 'mob', 'ally')] });
    expect(r.steps[0].ok).toBe(true);
    expect(r.steps[1].reason).toBe('sim.err.ap');
    expect(r.totals.ally!.damage.normal).toBeGreaterThan(0);
    expect(r.totals.main!.damage.normal).toBe(0);
  });
});

describe('simulate: el aliado como lanzador', () => {
  const heal = line({ kind: 'heal', side: 'ally', min: 100, max: 100, critMin: 100, critMax: 100 });
  const armor = line({ kind: 'armor', side: 'ally', min: 100, max: 100, critMin: 100, critMax: 100 });

  // El aliado es el curandero; el personaje principal recibe.
  const support = (): SimInput => {
    const input = fixture({ spells: [], actor: { stats: { healReceived: 20, armorReceived: 10, crit: 0 } } });
    input.actors.push({
      ...input.actors[0], id: 'ally', name: 'Curandero', start: { x: 4, y: 5 }, spells: [spellOf(1, {}, { lines: [heal, armor], perTurn: null })],
      stats: { mastHeal: 100, mastMelee: 100, healPct: 10, armorGiven: 50, crit: 0 }, ap: 8,
    });
    return input;
  };

  it('el aliado cura al personaje principal con sus estadísticas y las de quien recibe', () => {
    const r = simulate({ ...support(), steps: [{ type: 'adjust', hpPct: 50 }, castAt(1, 'ally', 'ally')] });
    const [h, a] = r.steps[1].rows;
    // cura: 100 × (1 + 700/100) × (1 + (10 + 20)/100) = 1040 (melé 100 + cura 100 + aire 500), limitada a los 500 PV que faltan
    expect(h.raw!.normal).toBe(1040);
    expect(h.value.normal).toBe(500);
    // armadura: 100 × (1 + (50 + 10)/100) = 160, al principal, no al aliado
    expect(a.value.normal).toBe(160);
    const st = r.steps[1].state.actors;
    expect([st.main!.hp, st.main!.armor]).toEqual([1000, 160]);
    expect([st.ally!.hp, st.ally!.armor]).toEqual([1000, 0]);
    expect(r.totals.ally!.heal.normal).toBe(500);
    expect(r.totals.main!.heal.normal).toBe(0);
  });

  it("'self' del aliado se aplica al aliado y la armadura propia no suma % dada", () => {
    const r = simulate({ ...support(), steps: [{ type: 'adjust', actor: 'ally', hpPct: 50 }, castAt(1, 'self', 'ally')] });
    const st = r.steps[1].state.actors;
    expect(st.ally!.armor).toBe(100);
    expect(st.ally!.hp).toBe(1000);
    expect(st.main!.armor).toBe(0);
  });

  it("el personaje principal con 'ally' llega al aliado", () => {
    const input = support();
    input.actors[0].spells = [spellOf(2, {}, { lines: [armor], perTurn: null })];
    const r = simulate({ ...input, steps: [castAt(2, 'ally')] });
    expect(r.steps[0].state.actors.ally!.armor).toBeGreaterThan(0);
    expect(r.steps[0].state.actors.main!.armor).toBe(0);
  });

  it('fin de turno restaura los recursos de los dos personajes', () => {
    const input = support();
    input.actors[0].spells = [spellOf(2, {}, { perTurn: null })];
    const r = simulate({ ...input, steps: [castAt(2, 'mob'), castAt(1, 'self', 'ally'), { type: 'endTurn' }] });
    const before = r.steps[1].state.actors;
    expect([before.main!.ap, before.ally!.ap]).toEqual([3, 5]);
    const after = r.steps[2].state.actors;
    expect([after.main!.ap, after.ally!.ap]).toEqual([6, 8]);
    expect(after.ally!.uses).toEqual({});
    expect(r.steps[2].state.turn).toBe(2);
  });

  it('los dos personajes no comparten casilla', () => {
    const r = simulate({ ...support(), steps: [{ type: 'move', actor: 'main', to: { x: 4, y: 5 } }] });
    expect(r.steps[0]).toMatchObject({ ok: false, reason: 'sim.err.cell' });
  });
});

describe('simulate: ajustes manuales a mitad de secuencia', () => {
  it('girar al objetivo cambia solo los golpes siguientes', () => {
    const turn = (f: 'e' | 'w'): SimStep => ({ type: 'adjust', facing: f });
    const r = simulate({ ...fixture(), steps: [...jab(), turn('e'), ...jab(), turn('w'), { type: 'endTurn' }, ...jab()] });
    const pos = r.steps.flatMap((s) => s.rows.map((x) => x.position));
    expect(pos).toEqual(['front', 'back', 'front']);
    const dmg = r.steps.flatMap((s) => s.rows.map((x) => x.value.normal));
    expect(dmg[1]).toBeGreaterThan(dmg[0]);
    expect(dmg[2]).toBe(dmg[0]);
  });

  it('fija un estado del personaje, con tope inferior en 0', () => {
    const r = simulate({
      ...fixture(), steps: [
        { type: 'adjust', state: { id: '3462', levels: 12 } }, { type: 'adjust', state: { id: '9', levels: -5 } },
      ],
    });
    expect(r.steps[0].state.actors.main!.states['3462']).toBe(12);
    expect(r.steps[1].state.actors.main!.states['9']).toBe(0);
  });
});

describe('simulate: hechizos centrados en el lanzador', () => {
  const ring = { target: 'aoe' as const, rangeMin: 0, rangeMax: 0, zone: { shape: 'ring', min: 1, max: 1 } };
  const square = { target: 'aoe' as const, rangeMin: 0, rangeMax: 0, zone: { shape: 'square', min: 0, max: 3 } };

  it('golpea al mob adyacente aunque el alcance sea 0', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, ring)] }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].ok).toBe(true);
    expect(r.steps[0].rows[0].value.normal).toBe(735);
  });

  it('fuera de la zona se rechaza con su motivo y no gasta nada', () => {
    const input = fixture({ spells: [spellOf(1, {}, ring)], target: { cell: { x: 8, y: 5 } } });
    const r = simulate({ ...input, steps: [castAt(1, 'mob')] });
    expect(r.steps[0]).toMatchObject({ ok: false, reason: 'sim.err.zone', rows: [] });
    expect(r.steps[0].state.actors.main!.ap).toBe(6);
  });

  it('la posición del golpe sale de la casilla del lanzador', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, ring)], target: { facing: 'e' } }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].rows[0].position).toBe('back');
  });

  it('una zona cuadrada cuenta las diagonales y un anillo no incluye el centro lejano', () => {
    const diag = fixture({ spells: [spellOf(1, {}, square)], target: { cell: { x: 8, y: 8 } } });
    expect(simulate({ ...diag, steps: [castAt(1, 'mob')] }).steps[0].ok).toBe(true);
    const far = fixture({ spells: [spellOf(1, {}, square)], target: { cell: { x: 9, y: 5 } } });
    expect(simulate({ ...far, steps: [castAt(1, 'mob')] }).steps[0].reason).toBe('sim.err.zone');
  });

  it('el aliado también tiene que estar en la zona', () => {
    const heal = line({ kind: 'heal', side: 'ally' });
    const base = fixture({ spells: [spellOf(1, {}, { ...ring, lines: [heal] })] });
    const ally = (start: { x: number; y: number }): SimActor => ({ ...base.actors[0], id: 'ally', start });
    const near = simulate({ ...base, actors: [base.actors[0], ally({ x: 5, y: 4 })], steps: [castAt(1, 'ally')] });
    expect(near.steps[0].ok).toBe(true);
    const far = simulate({ ...base, actors: [base.actors[0], ally({ x: 5, y: 1 })], steps: [castAt(1, 'ally')] });
    expect(far.steps[0].reason).toBe('sim.err.zone');
  });

  it('sin zona en la ficha usa la casilla adyacente', () => {
    const { zone: _, ...noZone } = ring;
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, noZone)] }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].ok).toBe(true);
  });
});

describe('simulate: efectos sin leer', () => {
  it('un hechizo con avisos y sin líneas da una fila sin calcular, aunque no tenga condicionales', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, { lines: [], reasons: ['secondary'], partial: true })] }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].rows).toEqual([
      expect.objectContaining({ uncalculated: true, warnings: ['sim.warn.secondary'] }),
    ]);
    expect(r.totals.main!.damage.normal).toBe(0);
  });

  it('sin avisos y sin líneas no hay fila', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, { lines: [] })] }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].rows).toEqual([]);
  });

  it('avisa de un crítico corregido', () => {
    const r = simulate({ ...fixture({ spells: [spellOf(1, {}, { reasons: ['critFixed'] })] }), steps: [castAt(1, 'mob')] });
    expect(r.steps[0].rows[0].warnings).toEqual(['sim.warn.critFixed']);
  });
});

describe('simulate: crítico igual al normal', () => {
  const same = line({ critMin: 50, critMax: 105 });

  it('sin bloque de críticos el crítico no suma maestría crítica ni resistencia crítica', () => {
    const input = fixture({ spells: [spellOf(1, {}, { lines: [same], reasons: ['noCrit'] })], target: { resCrit: 100 } });
    const row = simulate({ ...input, steps: [castAt(1, 'mob')] }).steps[0].rows[0];
    expect(row.value).toEqual({ normal: 735, crit: 735, avg: 735 });
    expect(row.warnings).toEqual(['sim.warn.noCrit']);
  });

  it('una línea sin pareja se trata igual y lo avisa, sin tocar las demás', () => {
    const input = fixture({ spells: [spellOf(1, {}, { lines: [{ ...same, noCrit: true }, line()], reasons: ['secondary'] })] });
    const [a, b] = simulate({ ...input, steps: [castAt(1, 'mob')] }).steps[0].rows;
    expect(a.value).toEqual({ normal: 735, crit: 735, avg: 735 });
    expect(a.warnings).toContain('sim.warn.noCrit');
    expect(b.value.crit).toBe(1056);
    expect(b.warnings).not.toContain('sim.warn.noCrit');
  });

  it('una cura sin crítico tampoco suma maestría crítica', () => {
    const heal = line({ kind: 'heal', side: 'ally', critMin: 50, critMax: 105 });
    const input = fixture({ spells: [spellOf(1, {}, { lines: [heal], reasons: ['noCrit'] })], actor: { maxHp: 100000 } });
    const steps: SimStep[] = [{ type: 'adjust', hpPct: 10 }, castAt(1, 'self')];
    const row = simulate({ ...input, steps }).steps[1].rows[0];
    expect(row.value.crit).toBe(row.value.normal);
    expect(row.raw!.crit).toBe(row.raw!.normal);
  });
});

describe('simulate: efectos que el objetivo deja fuera', () => {
  const heal = line({ kind: 'heal', side: 'ally' });

  it('lanzado al mob, avisa de la cura descartada en la fila de daño', () => {
    const input = fixture({ spells: [spellOf(1, {}, { lines: [line(), heal] })] });
    const { rows } = simulate({ ...input, steps: [castAt(1, 'mob')] }).steps[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].warnings).toEqual(['sim.warn.targetDropped']);
    expect(rows[0].value.normal).toBe(735);
  });

  it('un hechizo solo de daño lanzado sobre uno mismo da una fila sin calcular con el aviso', () => {
    const r = simulate({ ...fixture(), steps: [castAt(JABS, 'self')] });
    expect(r.steps[0].ok).toBe(true);
    expect(r.steps[0].rows).toEqual([
      expect.objectContaining({ uncalculated: true, warnings: ['sim.warn.targetDropped'] }),
    ]);
  });

  it('el daño propio no es un efecto descartado por el objetivo', () => {
    const input = fixture({ spells: [spellOf(1, {}, { lines: [line(), line({ side: 'caster' })] })] });
    const { rows } = simulate({ ...input, steps: [castAt(1, 'mob')] }).steps[0];
    expect(rows[0].warnings).toEqual([]);
  });
});

describe('simulate: mob derribado', () => {
  it('marca los golpes de los pasos posteriores a dejarlo a 0 PV', () => {
    const r = simulate({ ...fixture({ target: { hp: 700 } }), steps: jab(2) });
    expect(r.steps[0].state.mobHp).toBe(0);
    expect(r.steps[0].rows[0].tags).not.toContain('sim.tag.mobDown');
    expect(r.steps[1].rows[0].tags).toContain('sim.tag.mobDown');
  });
});

describe('simulate: PW entre turnos', () => {
  const COSTLY = 2;  // cuesta 2 PW, 1 PA
  const withWp = (actor: Partial<SimActor> = {}): SimInput => fixture({
    actor, spells: [spellOf(JABS), spellOf(COSTLY, {}, { ap: 1, wp: 2, perTurn: null })],
  });
  const wpAfter = (r: ReturnType<typeof simulate>, i: number) => r.steps[i].state.actors.main!.wp;

  it('los PW gastados no se recuperan al terminar el turno, pero PA y PM sí', () => {
    const r = simulate({ ...withWp(), steps: [castAt(COSTLY, 'mob'), { type: 'move', actor: 'main', to: { x: 5, y: 4 } }, { type: 'endTurn' }] });
    expect(wpAfter(r, 0)).toBe(4);
    const end = r.steps[2].state.actors.main!;
    expect(end.wp).toBe(4);
    expect(end.ap).toBe(6);
    expect(end.mp).toBe(4);
  });

  it('wpPerTurn devuelve PW al terminar el turno, sin pasar del máximo', () => {
    const r = simulate({ ...withWp({ wpPerTurn: 2 }), steps: [castAt(COSTLY, 'mob'), { type: 'endTurn' }, { type: 'endTurn' }] });
    expect(wpAfter(r, 1)).toBe(6);
    expect(wpAfter(r, 2)).toBe(6);
    const partial = simulate({ ...withWp({ wpPerTurn: 1 }), steps: [castAt(COSTLY, 'mob'), { type: 'endTurn' }] });
    expect(wpAfter(partial, 1)).toBe(5);
  });

  it('adjust.wp fija los PW para los pasos siguientes y respeta el máximo', () => {
    const r = simulate({
      ...withWp(), steps: [castAt(COSTLY, 'mob'), { type: 'adjust', wp: 6 }, castAt(COSTLY, 'mob'), { type: 'adjust', wp: 99 }],
    });
    expect(wpAfter(r, 1)).toBe(6);
    expect(wpAfter(r, 2)).toBe(4);
    expect(wpAfter(r, 3)).toBe(6);
  });

  it('sin PW suficientes el hechizo se rechaza', () => {
    const r = simulate({ ...withWp({ wp: 3 }), steps: [castAt(COSTLY, 'mob'), { type: 'endTurn' }, castAt(COSTLY, 'mob')] });
    expect(r.steps[2].ok).toBe(false);
    expect(r.steps[2].reason).toBe('sim.err.wp');
  });
});
