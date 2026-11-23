import { describe, expect, it } from 'vitest';
import { derive, evaluateBuild, recommend, toVector } from './optimizer';
import { gearRequest } from './teamGear';
import { RELIC, type Item, type Role } from './game';

const opts = (role: Role, classId: string) => ({ role, level: 200, berserk: false, back: false, classId });
const vec = (stats: Record<string, number>) => toVector(stats, undefined, undefined, ['fire']);

describe('dominio híbrido del Tymador', () => {
  it('Tymador melé cuenta el dominio distancia', () => {
    expect(derive(vec({ mastDist: 100 }), opts('melee', 'tymador')).mastery).toBe(100);
  });
  it('Tymador distancia cuenta el dominio melé', () => {
    expect(derive(vec({ mastMelee: 100 }), opts('dist', 'tymador')).mastery).toBe(100);
  });
  it('Tymador melé mantiene el término de espalda', () => {
    expect(derive(vec({ mastMelee: 100, mastDist: 50, mastBack: 40 }), opts('melee', 'tymador')).mastery).toBe(170);
  });
  it('otras clases no cambian', () => {
    expect(derive(vec({ mastDist: 100 }), opts('melee', 'yopuka')).mastery).toBe(0);
    expect(derive(vec({ mastMelee: 100 }), opts('dist', 'ocra')).mastery).toBe(0);
  });
});

describe('prioridad de PA y PM', () => {
  const item = (id: number, slot: Item['slot'], rarity: number, stats: Record<string, number>): Item =>
    ({ id, name: `I${id}`, lvl: 200, type: 0, slot, rarity, gfx: 0, stats, src: 'other' });
  // Objetivos justo en los PA/PM de base: los PA de más quedan por encima y el PM que falte, por debajo.
  const request = (pmShort: number) => {
    const req = gearRequest('yopuka', { role: 'melee', elements: ['fire'] }, { level: 200, craftOnly: false });
    const base = evaluateBuild({}, req).totals;
    return { ...req, targets: { ap: base.ap, mp: base.mp + pmShort, range: 0 } };
  };

  it('no usa la reliquia en una ranura cuyo recurso da también una pieza normal', () => {
    const relicBoots = item(1, 'legs', RELIC, { mp: 1, mastElem: 40 });
    const boots = item(2, 'legs', 4, { mp: 1 });
    const relicSword = item(3, 'weapon1', RELIC, { ap: 1 });
    const r = recommend([relicBoots, boots, relicSword], request(1));
    expect(r.slots.legs?.id).toBe(2);
    expect(r.slots.weapon?.id).toBe(3);
  });

  it('busca PA de más, pero no a costa del objetivo de PM', () => {
    const req = request(1);
    const ap = evaluateBuild({ weapon: item(3, 'weapon1', 4, { ap: 1 }) }, req).score;
    const mp = evaluateBuild({ legs: item(2, 'legs', 4, { mp: 1 }) }, req).score;
    expect(mp).toBeGreaterThan(ap);
    // Ni siquiera dos PA extra compensan quedarse un PM por debajo del objetivo.
    expect(mp).toBeGreaterThan(evaluateBuild({ weapon: item(3, 'weapon1', 4, { ap: 2 }) }, req).score);
    // Con el objetivo de PM cubierto, un PA extra vale más que un PM extra.
    const full = request(0);
    expect(evaluateBuild({ weapon: item(3, 'weapon1', 4, { ap: 1 }) }, full).score)
      .toBeGreaterThan(evaluateBuild({ legs: item(2, 'legs', 4, { mp: 1 }) }, full).score);
  });

  it('las armas a dos manos no dejan fuera de la búsqueda a una de una mano que rinde con segunda mano', () => {
    // 45 martillos con más dominio que la varita por sí sola, pero varita + daga suma más que cualquiera.
    const hammers = Array.from({ length: 45 }, (_, i) => item(100 + i, 'weapon2h', 4, { mastElem: 30 + i }));
    const wand = item(2, 'weapon1', 4, { mastElem: 20 });
    const dagger = item(3, 'offhand', 4, { mastElem: 60 });
    const r = recommend([...hammers, wand, dagger], request(0));
    expect(r.slots.weapon?.id).toBe(2);
    expect(r.slots.offhand?.id).toBe(3);
  });
});
