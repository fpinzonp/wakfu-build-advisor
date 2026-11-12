import spellsRaw from '../../public/data/spells.json?raw';
import { describe, expect, it } from 'vitest';
import { KIT, contributions, memberPlaces, recommendTeam, searchTeam, scoreTeam, type PlaceKind } from './teams';
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

describe('recommendTeam', () => {
  // Fijado antes de extraer searchTeam: el refactor no debe cambiar los resultados.
  it('resultados fijados', () => {
    const ids = (t: { classId: string; role: string }[]) => t.map((m) => `${m.classId}:${m.role}`);
    expect(ids(recommendTeam([{ classId: 'aniripsa', role: 'heal' }], 'rooms'))).toEqual(
      ['aniripsa:heal', 'steamer:dist', 'uginak:melee', 'feca:tank', 'xelor:dist', 'osamodas:dist']);
    expect(ids(recommendTeam([{ classId: 'sram', role: 'melee' }, { classId: 'feca', role: 'tank' }], 'stasis'))).toEqual(
      ['sram:melee', 'feca:tank', 'xelor:dist', 'aniripsa:heal', 'steamer:dist', 'anutrof:dist']);
    expect(ids(recommendTeam([{ classId: 'ocra', role: 'dist' }], 'trio'))).toEqual(
      ['ocra:dist', 'aniripsa:heal', 'feca:tank']);
  });
});

describe('searchTeam', () => {
  it('respeta el tamaño, los fijados y no repite clase', () => {
    const t = searchTeam([{ classId: 'ocra', role: 'dist' }], 4, (x) => scoreTeam(x));
    expect(t).toHaveLength(4);
    expect(t[0]).toEqual({ classId: 'ocra', role: 'dist' });
    expect(new Set(t.map((m) => m.classId)).size).toBe(4);
  });
});

describe('scoreTeam', () => {
  it('puntuación general fijada (igual que la antigua de salas)', () => {
    const team = [
      { classId: 'aniripsa', role: 'heal' }, { classId: 'feca', role: 'tank' }, { classId: 'sram', role: 'melee' },
      { classId: 'steamer', role: 'dist' }, { classId: 'xelor', role: 'dist' }, { classId: 'osamodas', role: 'dist' },
    ] as const;
    expect(scoreTeam([...team])).toBeCloseTo(15.8333333, 5);
  });
});
