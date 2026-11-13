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

it('"Common" de la wiki es la rareza 1 del juego', () => {
  const d = linkDrops([{ monster: 'X', item: 'Boots of Destiny/Common', rate: '1' }], [{ id: 5, en: 'Boots of Destiny', rarity: 1 }], []);
  expect(d[5]).toHaveLength(1);
});
it('filas duplicadas idénticas se muestran una vez', () => {
  const row = { monster: 'Wolfix', item: 'Dh Trophy', rate: '2' };
  expect(linkDrops([row, { ...row }], items, [])[3]).toHaveLength(1);
});
it('quita la aclaración entre paréntesis de la wiki', () => {
  const d = linkDrops([{ monster: 'X', item: 'Rose of the Sands (amulet)/Rare', rate: '1' }], [{ id: 8, en: 'Rose of the Sands', rarity: 2 }], []);
  expect(d[8]).toHaveLength(1);
});
it('sin nivel máximo usa el mínimo', () => {
  const d = linkDrops([{ monster: 'M', item: 'Dh Trophy', rate: '1' }], items, [{ name: 'M', minLevel: 150, maxLevel: 0 }]);
  expect(d[3][0]).toMatchObject({ minLevel: 150, maxLevel: 150 });
});
