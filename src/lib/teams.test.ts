import spellsRaw from '../../public/data/spells.json?raw';
import { describe, expect, it } from 'vitest';
import { KIT, contributions, memberPlaces, type PlaceKind } from './teams';
import { CLASSES } from './game';

const data = JSON.parse(spellsRaw) as { classes: Record<string, { id: number }[]> };
const KINDS: PlaceKind[] = ['push', 'pull', 'swap', 'teleport'];

describe('KIT', () => {
  it('cada hechizo de KIT existe en su clase', () => {
    for (const [classId, list] of Object.entries(KIT)) {
      const ids = (data.classes[classId] ?? []).map((s) => s.id);
      for (const x of list) expect(ids, `${classId} ${x.spell}`).toContain(x.spell);
    }
  });

  it('todo aporte de colocación tiene subtipo', () => {
    for (const list of Object.values(KIT)) for (const x of list) expect(x.need === 'place').toBe(x.place !== undefined);
  });

  it('hay al menos una clase por subtipo', () => {
    for (const k of KINDS) expect(Object.values(KIT).some((l) => l.some((x) => x.place === k)), k).toBe(true);
  });

  it('memberPlaces coincide con los aportes de colocación del miembro (respeta el rol)', () => {
    for (const classId of Object.keys(KIT)) {
      for (const role of CLASSES.find((c) => c.id === classId)?.roles ?? []) {
        const m = { classId, role };
        const expected = new Map<PlaceKind, number>();
        for (const x of contributions(m)) {
          if (x.need === 'place' && x.place) expected.set(x.place, Math.max(expected.get(x.place) ?? 0, x.power));
        }
        expect([...memberPlaces(m)].sort()).toEqual([...expected].sort());
      }
    }
  });
});
