import { describe, expect, it } from 'vitest';
import spellsJson from '../../../public/data/spells.json';
import type { Spell, SpellData } from '../spells';
import { castTarget } from './castTarget';

const data = spellsJson as unknown as SpellData;
const all: Spell[] = [...data.common, ...Object.values(data.classes).flat()];
const find = (key: string) => all.find((s) => s.cast?.key === key)!;

describe('castTarget con los datos reales', () => {
  it.each(['Pummel', 'Capering', 'Flaming Burp', 'Light Speed', 'Up to Scratch', 'Heads or Tails', 'Neurosis', 'Transfer'])(
    '%s va al mob también sin aliado', (key) => {
      expect(castTarget(find(key), false)).toBe('mob');
    },
  );

  it('un hechizo sin efectos sobre enemigos va a uno mismo, o al aliado si lo hay y lo recibe', () => {
    const armor = all.find((s) => s.cast && s.cast.lines.length > 0
      && s.cast.lines.every((l) => l.side !== 'enemy') && s.cast.conditional.length === 0 && !s.cast.berserkLines?.length
      && s.cast.rangeMax > 0 && s.cast.lines.some((l) => l.side === 'ally'))!;
    expect(castTarget(armor, false)).toBe('self');
    expect(castTarget(armor, true)).toBe('ally');
  });

  it('ningún hechizo con una línea de daño al enemigo, en cualquier rama, va a uno mismo', () => {
    const wrong = all.filter((s) => s.el !== 'passive' && s.cast && s.cast.rangeMax > 0
      && [...s.cast.lines, ...(s.cast.berserkLines ?? []), ...s.cast.conditional.flatMap((c) => c.lines)]
        .some((l) => l.kind === 'damage' && l.side === 'enemy')
      && castTarget(s, false) !== 'mob');
    expect(wrong.map((s) => s.cast!.key)).toEqual([]);
  });

  it('alcance 0 sin zona: solo se puede lanzar sobre uno mismo', () => {
    const s = { ...find('Pummel'), cast: { ...find('Pummel').cast!, rangeMin: 0, rangeMax: 0 } };
    expect(castTarget(s, false)).toBe('self');
  });
});
