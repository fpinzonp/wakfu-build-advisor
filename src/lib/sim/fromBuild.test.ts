import { describe, expect, it } from 'vitest';
import type { BuildResult } from '../optimizer';
import type { Spell } from '../spells';
import { actorFromBuild } from './fromBuild';

const result = {
  slots: {}, score: 0, aptitudes: { branches: [] },
  totals: { ap: 7, mp: 4, wp: 6, mastElem: 100, mastFire: 300, mastEarth: 50, mastMelee: 80, crit: 20 },
  derived: { hp: 5400 },
} as unknown as BuildResult;

const spell = (id: number, over: Partial<Spell> = {}): Spell => ({ id, name: `S${id}`, el: 'fire', lvl: 0, icon: 0, text: [], ...over });
const spells = [
  spell(1), spell(2), spell(3, { lvl: 200 }),
  spell(10, { el: 'passive', name: 'Disipación', key: 'Dissipation' }),
];
const base = { classId: 'yopuka', level: 100, elements: ['fire' as const, 'earth' as const], spells, start: { x: 1, y: 2 }, name: 'Yo' };

describe('actorFromBuild', () => {
  it('toma PA, PM, PW, PV y maestrías de la ficha', () => {
    const a = actorFromBuild('main', result, { ...base, deck: { actives: [1], passives: [] } });
    expect([a.ap, a.mp, a.wp, a.maxHp]).toEqual([7, 4, 6, 5400]);
    expect(a.mastery.fire).toBe(400);
    expect(a.mastery.earth).toBe(150);
    expect(a.mastery.water).toBe(100);
    expect(a.stats.mastMelee).toBe(80);
    expect(a.start).toEqual({ x: 1, y: 2 });
  });

  it('solo incluye los hechizos activos de la baraja', () => {
    const a = actorFromBuild('main', result, { ...base, deck: { actives: [2, 3, 99], passives: [10] } });
    expect(a.spells.map((s) => s.id)).toEqual([2]); // 3 supera el nivel y 99 no existe
    expect(a.passives).toEqual(['Dissipation']);
  });

  it('con baraja vacía devuelve spells vacío', () => {
    const a = actorFromBuild('main', result, { ...base, deck: { actives: [], passives: [] } });
    expect(a.spells).toEqual([]);
    expect(a.passives).toEqual([]);
  });
});
