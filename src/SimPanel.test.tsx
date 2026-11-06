// Pruebas de renderizado en servidor: comprueban que el panel monta y que la tabla no oculta nada.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SimPanel from './SimPanel';
import SimSteps from './SimSteps';
import { setLang } from './lib/i18n';
import type { BuildResult } from './lib/optimizer';
import type { StepResult } from './lib/sim/engine';
import type { Spell } from './lib/spells';

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
const props = { result, classId: 'yopuka', level: 245, elements: ['fire' as const], spells, active: true, onGoToDeck: () => undefined };

describe('SimPanel', () => {
  it('muestra el mapa y un botón por hechizo activo de la baraja', () => {
    const actives = spells.slice(0, 6).map((s) => s.id);
    const html = renderToString(<SimPanel {...props} deck={{ actives, passives: [] }} />);
    expect(html.match(/class="sim-cell/g)?.length).toBe(121);
    expect(html.match(/class="spell"/g)?.length).toBe(6);
    expect(html).toContain('Daño extra del combo');  // solo para yopuka
  });

  it('con la baraja vacía muestra el estado vacío con el botón a la baraja', () => {
    const html = renderToString(<SimPanel {...props} deck={{ actives: [], passives: [] }} />);
    expect(html).toContain('sim-empty');
    expect(html).not.toContain('sim-cell');
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
});
