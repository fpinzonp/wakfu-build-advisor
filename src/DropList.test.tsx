// Pruebas de la lista de drops de una pieza (renderizado en servidor).
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import DropList from './DropList';
import { setLang, setNames, type LangData } from './lib/i18n';
import { mobOption } from './SimTarget';
import type { Mob } from './lib/sim/mobs';

// Sin navegador: setLang toca document, así que se simula para fijar el español.
vi.stubGlobal('document', { documentElement: {} });
setLang('es');

it('lista monstruos con tipo, nivel y %', () => {
  const html = renderToString(<DropList drops={[{ monster: 'Sweepney the Chim', rate: 2, type: 'Archmonster', minLevel: 150, maxLevel: 155 }]} />);
  expect(html).toContain('Sweepney the Chim');
  expect(html).toContain('Archmonster');
  expect(html).toContain('150-155');
  expect(html).toContain('2 %');
});

it('sin tipo ni nivel muestra solo nombre y %', () => {
  const html = renderToString(<DropList drops={[{ monster: 'X', rate: 0.5 }]} />);
  expect(html).toContain('X');
  expect(html).toContain('0,5 %');
  expect(html).not.toContain('nv.');
});

it('muestra el nombre del monstruo en el idioma elegido', () => {
  setNames({ mobs: { Gobball: 'Jalató' } } as unknown as LangData);
  const html = renderToString(<DropList drops={[{ monster: 'Gobball', rate: 1 }, { monster: 'Sin Traducir', rate: 1 }]} />);
  expect(html).toContain('Jalató');
  expect(html).toContain('Sin Traducir');
  expect(html).not.toContain('Gobball');
});

it('mobOption traduce nombre y familia; sin traducción queda en inglés', () => {
  setNames({ mobs: { Gobball: 'Jalató' }, families: { Gobballs: 'Jalatós' } } as unknown as LangData);
  expect(mobOption({ name: 'Gobball', family: 'Gobballs', minLevel: 1, maxLevel: 5 } as Mob)).toBe('Jalató · Jalatós · nv. 1-5');
  expect(mobOption({ name: 'Srambad Guard', family: 'Srambad (family)', minLevel: 0, maxLevel: 0 } as Mob)).toBe('Srambad Guard · Srambad (family)');
});
