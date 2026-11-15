import { describe, expect, it } from 'vitest';
import type { DropData, Item, RecipeData } from './game';
import { defaultChoice, expectedFights, gearRequest, teamShopping } from './teamGear';

const item = (id: number, src: Item['src'], slot: Item['slot'] = 'head', lvl = 50): Item =>
  ({ id, name: `I${id}`, lvl, type: 0, slot, rarity: 3, gfx: 0, stats: {}, src });

const recipes: RecipeData = {
  version: '',
  recipes: {
    1: [{ job: 10, lvl: 50, ing: [[100, 2], [5, 1]], upgradeOf: 5 }],  // mejora de 5 (base de drop)
    2: [{ job: 11, lvl: 40, ing: [[100, 3], [101, 1]] }],
  },
  ingredients: {},
};
const drops: DropData = {
  version: '', source: '',
  drops: { 3: [{ monster: 'a', rate: 1 }, { monster: 'b', rate: 5 }] },
};

describe('sets del equipo', () => {
  it('el tipo de set por defecto usa el rol dado y dos ramas de la clase', () => {
    expect(defaultChoice('yopuka', 'melee')).toEqual({ role: 'melee', elements: ['fire', 'earth'] });
  });

  it('todas las peticiones comparten nivel y filtros', () => {
    const r = gearRequest('sram', { role: 'melee', elements: ['air'] }, { level: 140, craftOnly: true });
    expect(r).toMatchObject({ level: 140, classId: 'sram', role: 'melee', elements: ['air'], craftOnly: true, crit: true, back: true });
  });

  it('suma piezas repetidas y desglosa la receta completa', () => {
    const s = teamShopping([
      { classId: 'feca', slots: { head: item(1, 'craft'), neck: item(2, 'craft', 'neck'), back: item(3, 'other', 'back') } },
      { classId: 'sram', slots: { head: item(1, 'craft'), back: item(3, 'other', 'back'), pet: item(4, 'other', 'pet') } },
    ], recipes, drops);

    expect(s.craft.map((p) => [p.item.id, p.count])).toEqual([[1, 2], [2, 1]]);
    const qty = Object.fromEntries(s.materials!.materials.map((m) => [m.id, m.qty]));
    expect(qty).toEqual({ 100: 7, 5: 2, 101: 1 });
    expect(s.drops).toHaveLength(1);
    expect(s.drops[0]).toMatchObject({ count: 2, owners: ['feca', 'sram'] });
    expect(s.drops[0].drops.map((d) => d.monster)).toEqual(['b', 'a']);
    expect(s.others.map((p) => p.item.id)).toEqual([4]);
  });

  it('combates de media según la probabilidad', () => {
    expect(expectedFights(5)).toBe(20);
    expect(expectedFights(5, 2)).toBe(40);
    expect(expectedFights(0)).toBe(Infinity);
  });
});
