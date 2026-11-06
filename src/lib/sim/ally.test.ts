import { describe, expect, it } from 'vitest';
import type { Item } from '../game';
import { encodeBuild, EMPTY_ENCHANT, type SavedBuild, type StoredBuild } from '../share';
import type { Spell, SpellData } from '../spells';
import { allyFromStored } from './ally';

const item = (id: number): Item => ({
  id, name: `Objeto ${id}`, lvl: 100, type: 1, slot: 'head', rarity: 3, gfx: 0, src: 'craft',
  stats: { hp: 500, ap: 1, mastElem: 40 },
}) as unknown as Item;

const items = [item(1), item(2)];
const heal: Spell = { id: 7, name: 'Cura', el: 'water', lvl: 0, icon: 0, text: [] };
const data: SpellData = { version: '', common: [], classes: { aniripsa: [heal] } };

const saved = (over: Partial<SavedBuild> = {}): SavedBuild => ({
  settings: {
    level: 100, classId: 'aniripsa', role: 'heal', elements: ['water'], targets: { ap: 7, mp: 3, range: 0 },
    rarities: [3], minLevel: 0, craftOnly: false, berserk: false, crit: false, back: false, excluded: [],
  },
  slots: { head: 1 }, locked: [], enchant: EMPTY_ENCHANT, deck: { actives: [7], passives: [] }, ...over,
});

const stored = (build: SavedBuild | string): StoredBuild => ({
  id: 'a', name: 'Mi curandero', date: '', summary: '', code: typeof build === 'string' ? build : encodeBuild(build),
});

describe('allyFromStored', () => {
  it('crea el aliado desde una build guardada', () => {
    const ally = allyFromStored(stored(saved()), items, data)!;
    expect(ally).not.toBeNull();
    expect(ally.id).toBe('ally');
    expect(ally.name).toBe('Mi curandero');
    expect(ally.classId).toBe('aniripsa');
    expect(ally.level).toBe(100);
    expect(ally.maxHp).toBeGreaterThan(0);
    expect(ally.spells.map((s) => s.id)).toEqual([7]);
    expect(ally.start).toEqual({ x: 3, y: 3 });
  });

  it('devuelve null con un código roto', () => {
    expect(allyFromStored(stored('esto-no-es-un-codigo'), items, data)).toBeNull();
  });

  it('devuelve null si ningún objeto existe ya', () => {
    expect(allyFromStored(stored(saved({ slots: { head: 999 } })), items, data)).toBeNull();
  });

  it('devuelve null con una clase desconocida', () => {
    const s = saved();
    expect(allyFromStored(stored({ ...s, settings: { ...s.settings, classId: 'nada' } }), items, data)).toBeNull();
  });
});
