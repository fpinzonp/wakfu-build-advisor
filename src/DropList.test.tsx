// Pruebas de la lista de drops de una pieza (renderizado en servidor).
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import DropList from './DropList';
import { setLang } from './lib/i18n';

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
