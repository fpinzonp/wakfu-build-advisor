// Pruebas de renderizado en servidor: comprueban que el panel monta y que la tabla no oculta nada.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SimMap from './SimMap';
import SimPanel, { castTarget, needsAlly, shownFacing } from './SimPanel';
import { facingStep } from './SimAdjust';
import { AllyList } from './SimAlly';
import SimSteps from './SimSteps';
import { mobOption } from './SimTarget';
import { setLang } from './lib/i18n';
import type { BuildResult } from './lib/optimizer';
import type { Mob } from './lib/sim/mobs';
import type { StepResult } from './lib/sim/engine';
import type { Spell, SpellCast, SpellData, SpellLine } from './lib/spells';

// Sin navegador: setLang toca document, así que se simula para fijar el español.
vi.stubGlobal('document', { documentElement: {} });
setLang('es');
const spells: Spell[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, name: `Hechizo ${i + 1}`, el: 'fire', lvl: 0, icon: 0, text: [],
  cast: {
    key: `S${i}`, ap: 3, mp: 0, wp: 0, rangeMin: 1, rangeMax: 2, rangeMod: false, los: true, perTurn: null, target: 'st',
    lines: [], conditional: [], stateGains: [], reasons: [], partial: false,
  },
}));
const result = {
  slots: {}, score: 0, aptitudes: { branches: [] }, derived: { hp: 5000 },
  totals: { ap: 12, mp: 5, wp: 6, mastFire: 800, mastMelee: 300, crit: 20, range: 0 },
} as unknown as BuildResult;
const spellData: SpellData = { version: '', common: [], classes: { yopuka: spells } };
const props = {
  result, classId: 'yopuka', level: 245, elements: ['fire' as const], spells, items: [], spellData: null,
  active: true, onGoToDeck: () => undefined,
};

describe('SimPanel', () => {
  it('muestra el mapa y un botón por hechizo activo de la baraja', () => {
    const actives = spells.slice(0, 6).map((s) => s.id);
    const html = renderToString(<SimPanel {...props} deck={{ actives, passives: [] }} />);
    expect(html.match(/class="sim-cell/g)?.length).toBe(121);
    expect(html.match(/class="spell"/g)?.length).toBe(6);
    expect(html).toContain('Daño extra del combo');  // solo para yopuka
  });

  it('el botón de añadir aliado espera a que lleguen los hechizos y no cambia el resto de la interfaz', () => {
    const deck = { actives: [1, 2], passives: [] };
    const sin = renderToString(<SimPanel {...props} deck={deck} />);
    expect(sin).toMatch(/<button[^>]*disabled=""[^>]*>Añadir aliado/);
    expect(sin).not.toContain('Quién actúa');
    expect(sin).not.toContain('Objetivo del próximo hechizo');
    const con = renderToString(<SimPanel {...props} items={[{ id: 1 } as never]} spellData={spellData} deck={deck} />);
    expect(con).not.toMatch(/<button[^>]*disabled=""[^>]*>Añadir aliado/);
    expect(con).toContain('Añadir aliado');
  });

  it('muestra PV y armadura como barras aparte', () => {
    const html = renderToString(<SimPanel {...props} deck={{ actives: [1], passives: [] }} />);
    expect(html).toContain('sim-bar hp');
    expect(html).toContain('sim-bar armor');
    expect(html).toContain('Armadura 0/2500');
  });

  it('con la baraja vacía muestra el estado vacío con el botón a la baraja', () => {
    const html = renderToString(<SimPanel {...props} deck={{ actives: [], passives: [] }} />);
    expect(html).toContain('sim-empty');
    expect(html).not.toContain('sim-cell');
  });
});

describe('AllyList', () => {
  it('sin builds guardadas explica cómo guardar una y no ofrece nada más', () => {
    const html = renderToString(<AllyList list={[]} onPick={() => undefined} />);
    expect(html).toContain('Aún no tienes builds guardadas');
    expect(html).toContain('Guardar');
    expect(html).not.toContain('<button');
  });

  it('lista las builds guardadas', () => {
    const html = renderToString(<AllyList list={[{ id: 'a', name: 'Mi curandero', date: '2026-01-01', summary: 'Aniripsa', code: '' }]} onPick={() => undefined} />);
    expect(html).toContain('Mi curandero');
  });
});

describe('SimSteps', () => {
  const state = { actors: {}, mobHp: 0, facing: 'w' as const, turn: 1 };
  const steps: StepResult[] = [
    {
      step: { type: 'cast', actor: 'main', spell: 1, target: 'mob' }, ok: true, state,
      rows: [{ kind: 'damage', value: { normal: 0, crit: 0, avg: 0 }, tags: [], warnings: ['sim.warn.noData'], uncalculated: true }],
    },
    { step: { type: 'cast', actor: 'main', spell: 1, target: 'mob' }, ok: false, reason: 'sim.err.ap', rows: [], state },
  ];

  it('un paso sin calcular dice "sin calcular", no 0, y muestra su aviso; el no válido muestra su motivo', () => {
    const html = renderToString(<SimSteps steps={steps} selected={0} spellName={() => 'Jabs'} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(html).toContain('sin calcular');
    expect(html).toContain('Sin datos de la wiki');
    expect(html).toContain('No quedan PA suficientes');
    expect(html).toContain('No válido');
  });

  it('rotula los ajustes de orientación, armadura y estado', () => {
    const adjusts: StepResult[] = [
      { step: { type: 'adjust', facing: 'e' }, ok: true, rows: [], state },
      { step: { type: 'adjust', armor: 300 }, ok: true, rows: [], state },
      { step: { type: 'adjust', state: { id: '3462', levels: 20 } }, ok: true, rows: [], state },
    ];
    const html = renderToString(<SimSteps steps={adjusts} selected={0} spellName={() => undefined} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(html).toContain('El objetivo mira: Derecha');
    expect(html).toContain('Armadura fijada en 300');
    expect(html).toContain('Preparación fijada en 20');
  });

  it('con aliado indica quién actúa y a quién, y enseña el valor bruto de una cura limitada', () => {
    const names = { main: 'Yo', ally: 'Curandero', mob: 'Maniquí' };
    const rows: StepResult[] = [
      {
        step: { type: 'cast', actor: 'ally', spell: 1, target: 'ally' }, ok: true, state,
        rows: [{ kind: 'heal', value: { normal: 20, crit: 20, avg: 20 }, raw: { normal: 2080, crit: 2500, avg: 2100 }, tags: [], warnings: [] }],
      },
      { step: { type: 'cast', actor: 'main', spell: 1, target: 'mob' }, ok: true, rows: [], state },
      { step: { type: 'move', actor: 'ally', to: { x: 1, y: 1 } }, ok: true, rows: [], state },
    ];
    const html = renderToString(<SimSteps steps={rows} selected={0} spellName={() => 'Cura'} names={names} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(html).toContain('Curandero → Yo');
    expect(html).toContain('Yo → Maniquí');
    expect(html).toContain('bruto 2100');
    const solo = renderToString(<SimSteps steps={rows} selected={0} spellName={() => 'Cura'} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(solo).not.toContain('→');
  });
});

describe('SimPanel: funciones de apoyo', () => {
  const castOf = (over: Partial<SpellCast>): Spell => ({ ...spells[0], cast: { ...spells[0].cast!, ...over } });
  const dmg: SpellLine = { kind: 'damage', side: 'enemy', min: 1, max: 2, critMin: 1, critMax: 2 };

  it('un hechizo centrado en el lanzador va al mob; uno de alcance 0 sin zona, a uno mismo', () => {
    expect(castTarget(castOf({ target: 'aoe', rangeMin: 0, rangeMax: 0, lines: [dmg] }), false)).toBe('mob');
    expect(castTarget(castOf({ rangeMin: 0, rangeMax: 0, lines: [] }), false)).toBe('self');
    expect(castTarget(castOf({ rangeMin: 0, rangeMax: 0, lines: [] }), true)).toBe('self');
  });

  it('la orientación del mapa es la del paso mostrado', () => {
    expect(shownFacing({ actors: {}, mobHp: 1, facing: 'e', turn: 1 }, 'w')).toBe('e');
    expect(shownFacing(null, 'w')).toBe('w');
  });

  it('un giro del objetivo no es de ningún personaje: sobrevive a quitar el aliado', () => {
    const step = facingStep('e');
    expect(step).toEqual({ type: 'adjust', facing: 'e' });
    expect(needsAlly(step)).toBe(false);
    expect(needsAlly({ type: 'adjust', actor: 'ally', hpPct: 50 })).toBe(true);
  });
});

describe('SimMap', () => {
  it('dibuja y rotula la orientación que recibe', () => {
    const html = renderToString(<SimMap me={{ x: 0, y: 0 }} mob={{ x: 5, y: 5 }} facing="e" onCell={() => undefined} />);
    expect(html).toContain('▶');
    expect(html).toContain('mira Derecha');
  });
});

describe('SimSteps: etiquetas con valor', () => {
  const state = { actors: {}, mobHp: 0, facing: 'w' as const, turn: 1 };

  it('el coste de PV enseña su porcentaje', () => {
    const steps: StepResult[] = [{
      step: { type: 'cast', actor: 'main', spell: 1, target: 'mob' }, ok: true, state,
      rows: [{ kind: 'damage', value: { normal: 1, crit: 1, avg: 1 }, tags: ['sim.tag.hpCost'], tagVars: { pct: 10 }, warnings: [] }],
    }];
    const html = renderToString(<SimSteps steps={steps} selected={0} spellName={() => 'Sangre'} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(html).toContain('10 % de los PV máximos');
  });

  it('un giro del objetivo no indica quién actúa', () => {
    const steps: StepResult[] = [{ step: { type: 'adjust', facing: 'e' }, ok: true, rows: [], state }];
    const names = { main: 'Yo', ally: 'Curandero', mob: 'Maniquí' };
    const html = renderToString(<SimSteps steps={steps} selected={0} spellName={() => undefined} names={names} onSelect={() => undefined} onRemove={() => undefined} />);
    expect(html).not.toContain('sim-who');
  });
});

describe('mobOption', () => {
  const mob = (minLevel: number, maxLevel: number) => ({ name: 'Tofu', family: 'Tofus', minLevel, maxLevel }) as Mob;

  it('rotula el nivel, y lo omite si la wiki no lo da', () => {
    expect(mobOption(mob(35, 35))).toBe('Tofu · Tofus · nv. 35-35');
    expect(mobOption(mob(0, 0))).toBe('Tofu · Tofus');
  });
});
