import { describe, expect, it } from 'vitest';
import { EPIC, ROLE_DEFAULT_TARGETS, type DropData, type Item, type RecipeData } from './game';
import { defaultChoice, dropsToFarm, expectedFights, gearRequest, keepWithout, replaceOptions, stillNeeded, teamShopping } from './teamGear';

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

  it('los PA/PM/alcance de cada personaje sustituyen a los del rol', () => {
    const own = gearRequest('ocra', { role: 'dist', elements: ['fire'], targets: { ap: 13, mp: 5, range: 4 } }, { level: 200, craftOnly: false });
    expect(own.targets).toEqual({ ap: 13, mp: 5, range: 4 });
    const def = gearRequest('ocra', { role: 'dist', elements: ['fire'] }, { level: 200, craftOnly: false });
    expect(def.targets).toEqual(ROLE_DEFAULT_TARGETS('dist', 200));
  });

  it('las piezas descartadas se excluyen y el resto se puede fijar', () => {
    const r = gearRequest('sram', { role: 'melee', elements: ['air'] }, { level: 140, craftOnly: false }, [7, 8], { head: item(1, 'craft') });
    expect([...r.excluded]).toEqual([7, 8]);
    expect(r.locked.head?.id).toBe(1);
  });

  it('al descartar una pieza se conserva el resto salvo lo que la exige', () => {
    const sword = { ...item(10, 'other', 'weapon1'), cond: [{ needs: 3 }] } as Item;
    const keep = keepWithout({ head: item(1, 'craft'), back: item(3, 'other', 'back'), weapon: sword, neck: item(2, 'craft', 'neck') }, 3);
    expect(Object.keys(keep).sort()).toEqual(['head', 'neck']);
  });

  it('al descartar un épico también se prueba liberar cada otra ranura para otro épico', () => {
    const epic = { ...item(3, 'other', 'back'), rarity: EPIC } as Item;
    const slots = { head: item(1, 'craft'), back: epic, neck: item(2, 'craft', 'neck') };
    const opts = replaceOptions(slots, 3).map((o) => Object.keys(o).sort());
    expect(opts).toEqual([['head', 'neck'], ['neck'], ['head']]);
    // Una pieza normal solo libera su propia ranura
    expect(replaceOptions(slots, 1).map((o) => Object.keys(o).sort())).toEqual([['back', 'neck']]);
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

  it('las piezas crafteables que ya se tienen salen de la receta', () => {
    const builds = [
      { classId: 'feca', slots: { head: item(1, 'craft'), neck: item(2, 'craft', 'neck') } },
      { classId: 'sram', slots: { head: item(1, 'craft') } },
    ];
    const qty = (owned: Record<number, number>) =>
      Object.fromEntries(teamShopping(builds, recipes, drops, owned).materials!.materials.map((m) => [m.id, m.qty]));
    expect(qty({ 1: 1 })).toEqual({ 100: 5, 5: 1, 101: 1 });
    expect(qty({ 1: 2, 2: 1 })).toEqual({});
    // La lista de piezas sigue completa para poder desmarcarlas.
    expect(teamShopping(builds, recipes, drops, { 1: 2 }).craft).toHaveLength(2);
  });

  it('las piezas de drop que ya se tienen dejan de contar', () => {
    const p = (id: number, count: number, r: number) =>
      ({ item: item(id, 'other'), count, owners: [], drops: [{ monster: 'm', rate: r }] });
    const list = dropsToFarm([p(1, 1, 10), p(2, 2, 1), p(3, 1, 50)], { 1: 1, 2: 1 });
    expect(list.map((x) => [x.piece.item.id, x.need])).toEqual([[2, 1], [3, 1], [1, 0]]);
    expect(stillNeeded(p(2, 2, 1), { 2: 5 })).toBe(0);
  });

  it('combates de media según la probabilidad', () => {
    expect(expectedFights(5)).toBe(20);
    expect(expectedFights(5, 2)).toBe(40);
    expect(expectedFights(0)).toBe(Infinity);
  });
});
