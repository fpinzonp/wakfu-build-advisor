import { expect, it } from 'vitest';
import { linkDrops } from './drops.mjs';

const items = [
  { id: 1, en: 'Zinit Cloak', rarity: 3 }, { id: 2, en: 'Zinit Cloak', rarity: 4 },
  { id: 3, en: 'Dh Trophy', rarity: 0 }, { id: 4, en: 'Dh Trophy', rarity: 2 },
];
const mobs = [{ name: 'Sweepney the Chim', type: 'Archmonster', minLevel: 150, maxLevel: 155 }];

it('empareja por nombre y rareza', () => {
  const d = linkDrops([{ monster: 'Sweepney the Chim', item: 'Zinit Cloak/Mythical', rate: '2' }], items, mobs);
  expect(d[1]).toEqual([{ monster: 'Sweepney the Chim', rate: 2, type: 'Archmonster', minLevel: 150, maxLevel: 155 }]);
  expect(d[2]).toBeUndefined();
});
it('sin rareza se asigna a todos los ids con ese nombre', () => {
  const d = linkDrops([{ monster: 'X', item: 'Dh Trophy', rate: '10' }], items, []);
  expect(d[3]).toEqual([{ monster: 'X', rate: 10 }]);
  expect(d[4]).toEqual([{ monster: 'X', rate: 10 }]);
});
it('ordena por % descendente y descarta % no numérico', () => {
  const rows = [{ monster: 'A', item: 'Dh Trophy', rate: '1' }, { monster: 'B', item: 'Dh Trophy', rate: '5' }, { monster: 'C', item: 'Dh Trophy', rate: '' }];
  expect(linkDrops(rows, items, [])[3].map((x) => x.monster)).toEqual(['B', 'A']);
});
it('un sufijo que no es rareza es parte del nombre', () => {
  const d = linkDrops([{ monster: 'X', item: 'AC/DC Ring', rate: '1' }], [{ id: 9, en: 'AC/DC Ring', rarity: 2 }], []);
  expect(d[9]).toHaveLength(1);
});
it('nombres se comparan sin mayúsculas ni apóstrofos tipográficos', () => {
  const d = linkDrops([{ monster: 'X', item: 'gobball’s hat/Rare', rate: '1' }], [{ id: 7, en: "Gobball's Hat", rarity: 2 }], []);
  expect(d[7]).toHaveLength(1);
});
