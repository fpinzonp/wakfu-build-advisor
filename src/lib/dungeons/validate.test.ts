import { describe, expect, it } from 'vitest';
import { checkDungeon } from './validate';
import type { Dungeon, L10n, Room } from './types';

const t = (s: string): L10n => ({ es: s, en: s, fr: s });

function room(): Room {
  return {
    id: 'r1', name: t('Sala'), size: { w: 5, h: 5 },
    pieces: [
      { id: 'boss', kind: 'boss', name: t('Jefe'), role: t('Rol'), cell: { x: 1, y: 1 } },
      { id: 'pj', kind: 'char', name: t('PJ'), cell: { x: 3, y: 3 } },
    ],
    condition: t('Cond'), duration: t('Dur'),
    steps: [
      { text: t('Inicio'), changes: [] },
      { text: t('Mover'), actor: 'boss', changes: [{ type: 'move', piece: 'boss', to: { x: 2, y: 2 } }] },
    ],
  };
}
const base = (): Dungeon => ({ id: 'd', tier: [20, 35], name: t('Mazmorra'), guide: 'https://ejemplo.com', rooms: [room()] });
const withRoom = (f: (r: Room) => void): Dungeon => { const d = base(); f(d.rooms[0]); return d; };

describe('checkDungeon', () => {
  it('una mazmorra válida no da errores', () => expect(checkDungeon(base())).toEqual([]));

  it('traducción vacía o ausente', () => {
    const d = base(); d.name.fr = '';
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('falta traducción'));
    const d2 = withRoom(r => { delete (r.pieces[0].role as Partial<L10n>).en; });
    expect(checkDungeon(d2)).toContainEqual(expect.stringContaining('falta traducción'));
    const d3 = withRoom(r => { r.steps[1].text.es = ' '; });
    expect(checkDungeon(d3)).toContainEqual(expect.stringContaining('falta traducción'));
    const d4 = withRoom(r => { r.steps[1].changes.push({ type: 'counter', id: 'c', name: { ...t('x'), en: '' }, value: '1' }); });
    expect(checkDungeon(d4)).toContainEqual(expect.stringContaining('falta traducción'));
    const d5 = withRoom(r => { r.condition.es = ''; });
    expect(checkDungeon(d5)).toContainEqual(expect.stringContaining('falta traducción'));
    const d6 = withRoom(r => { r.duration.es = ''; });
    expect(checkDungeon(d6)).toContainEqual(expect.stringContaining('falta traducción'));
  });

  it('tramo inválido', () => {
    for (const tier of [[40, 20], [0, 10], [10, 231]] as [number, number][]) {
      const d = base(); d.tier = tier;
      expect(checkDungeon(d)).toContainEqual(expect.stringContaining('tramo'));
    }
  });

  it('guía sin https', () => {
    const d = base(); d.guide = 'http://x.com';
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('guía'));
  });

  it('sin salas', () => {
    const d = base(); d.rooms = [];
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('sin salas'));
  });

  it('sala sin pasos y paso 0 con cambios', () => {
    expect(checkDungeon(withRoom(r => { r.steps = []; }))).toContainEqual(expect.stringContaining('sin pasos'));
    const d = withRoom(r => { r.steps[0].changes = [{ type: 'aura', piece: 'boss', on: true }]; });
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('paso 0'));
  });

  it('ids repetidos', () => {
    expect(checkDungeon(withRoom(r => { r.pieces[1].id = 'boss'; }))).toContainEqual(expect.stringContaining('id repetido'));
    const d = withRoom(r => { r.steps[1].changes.push({ type: 'add', piece: { id: 'pj', kind: 'mob', name: t('M'), cell: { x: 0, y: 0 } } }); });
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('id repetido'));
  });

  it('casillas fuera del tablero', () => {
    const out = { x: 9, y: 0 };
    const cases: ((r: Room) => void)[] = [
      r => { r.pieces[0].cell = out; },
      r => { r.steps[1].changes = [{ type: 'move', piece: 'boss', to: out }]; },
      r => { r.steps[1].changes = [{ type: 'move', piece: 'boss', to: { x: 2, y: 2 }, path: [out] }]; },
      r => { r.tiles = [{ cells: [out], color: 'red' }]; },
      r => { r.steps[1].changes = [{ type: 'tiles', cells: [out], color: 'blue' }]; },
      r => { r.steps[1].changes = [{ type: 'zone', zone: { kind: 'hit', cells: [out] } }]; },
      r => { r.steps[1].changes = [{ type: 'zone', zone: { kind: 'hit', center: out, radius: 1 } }]; },
      r => { r.steps[1].changes = [{ type: 'add', piece: { id: 'n', kind: 'mob', name: t('M'), cell: { x: -1, y: 0 } } }]; },
    ];
    for (const f of cases) expect(checkDungeon(withRoom(f))).toContainEqual(expect.stringContaining('fuera del tablero'));
  });

  it('pieza desconocida o ya quitada', () => {
    expect(checkDungeon(withRoom(r => { r.steps[1].changes = [{ type: 'aura', piece: 'nadie', on: true }]; })))
      .toContainEqual(expect.stringContaining('pieza desconocida'));
    expect(checkDungeon(withRoom(r => { r.steps[1].actor = 'nadie'; })))
      .toContainEqual(expect.stringContaining('pieza desconocida'));
    const d = withRoom(r => {
      r.steps[1].changes = [{ type: 'remove', piece: 'boss' }];
      r.steps.push({ text: t('x'), changes: [{ type: 'label', piece: 'boss', label: 'A' }] });
    });
    expect(checkDungeon(d)).toContainEqual(expect.stringContaining('pieza desconocida'));
  });

  it('dos piezas en la misma casilla', () => {
    expect(checkDungeon(withRoom(r => { r.steps[1].changes = [{ type: 'move', piece: 'boss', to: { x: 3, y: 3 } }]; })))
      .toContainEqual(expect.stringContaining('misma casilla'));
  });

  it('los mensajes llevan el prefijo de mazmorra, sala y paso', () => {
    const errs = checkDungeon(withRoom(r => { r.steps[1].changes = [{ type: 'aura', piece: 'nadie', on: true }]; }));
    expect(errs[0].startsWith('d/r1 paso 1')).toBe(true);
  });
});
