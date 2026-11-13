import { expect, it } from 'vitest';
import { buildNames, parseProperties, translateNames } from './mob-names.mjs';

it('lee claves, escapes \\u y recorta espacios', () => {
  const p = parseProperties('# comentario\ncontent.7.1=Gobball \ncontent.7.2=Caf\\u00e9\r\nfoo=bar');
  expect(p.get('content.7.1')).toBe('Gobball');
  expect(p.get('content.7.2')).toBe('Café');
  expect(p.get('foo')).toBe('bar');
});

it('cruza monstruos y familias por id y gana la traducción más frecuente', () => {
  const en = new Map([['content.7.1', 'Gobball'], ['content.7.2', 'Gobball'], ['content.7.3', 'Gobball'], ['content.38.2', 'Gobballs'], ['content.15.9', 'Gobball Wool']]);
  const es = new Map([['content.7.1', 'Jalató'], ['content.7.2', 'Jalató'], ['content.7.3', 'Jalato'], ['content.38.2', 'Jalatós'], ['content.15.9', 'Lana']]);
  const fr = new Map([['content.7.1', 'Bouftou'], ['content.38.2', 'Bouftous']]);
  const n = buildNames(en, es, fr);
  expect(n.monsters.Gobball).toEqual({ es: 'Jalató', fr: 'Bouftou' });
  expect(n.families.Gobballs).toEqual({ es: 'Jalatós', fr: 'Bouftous' });
  expect(n.monsters['Gobball Wool']).toBeUndefined();
});

it('translateNames conserva las variantes y quita las aclaraciones genéricas de la wiki', () => {
  const dict = { Jadarmed: { es: 'Jadarmado' }, Srambad: { es: 'Sramvil' }, Gobball: { es: 'Jalató' }, Tofu: { es: 'Tofu' } };
  expect(translateNames(dict, ['Jadarmed (36-50)', 'Srambad (family)', 'Gobball', 'Tofu', 'Nadie'], 'es')).toEqual({
    'Jadarmed (36-50)': 'Jadarmado (36-50)', 'Srambad (family)': 'Sramvil', Gobball: 'Jalató',
  });
});
