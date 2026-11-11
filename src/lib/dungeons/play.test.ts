import { describe, it, expect } from 'vitest';
import { boardAt, zoneCells } from './play';
import type { Room } from './types';

const n = (s: string) => ({ es: s, en: s, fr: s });

const room: Room = {
  id: 'r', name: n('Sala'), size: { w: 9, h: 9 },
  pieces: [
    { id: 'b', kind: 'boss', name: n('Boss'), cell: { x: 4, y: 3 }, invulnerable: true },
    { id: 'n', kind: 'mob', name: n('Nodkoko'), cell: { x: 4, y: 1 }, label: '1' },
    { id: 'c', kind: 'char', name: n('Pj'), cell: { x: 4, y: 5 } },
  ],
  condition: n('c'), duration: n('d'),
  steps: [
    { text: n('0'), changes: [] },
    { text: n('1'), actor: 'c', changes: [{ type: 'move', piece: 'b', to: { x: 4, y: 2 }, path: [] }] },
    { text: n('2'), changes: [
      { type: 'zone', zone: { kind: 'explosion', center: { x: 4, y: 1 }, radius: 2 } },
      { type: 'label', piece: 'n', label: '💥' },
    ] },
    { text: n('3'), changes: [
      { type: 'remove', piece: 'n' },
      { type: 'aura', piece: 'b', on: false },
      { type: 'counter', id: 't', name: n('T'), value: '1' },
    ] },
  ],
};

describe('zoneCells', () => {
  it('rombo Manhattan recortado al tablero', () => {
    expect(zoneCells({ kind: 'explosion', center: { x: 0, y: 0 }, radius: 1 }, { w: 9, h: 9 }))
      .toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]));
    expect(zoneCells({ kind: 'explosion', center: { x: 0, y: 0 }, radius: 1 }, { w: 9, h: 9 })).toHaveLength(3);
    expect(zoneCells({ kind: 'explosion', center: { x: 4, y: 4 }, radius: 2 }, { w: 9, h: 9 })).toHaveLength(13);
    expect(zoneCells({ kind: 'glyph', cells: [{ x: 1, y: 1 }, { x: 20, y: 1 }] }, { w: 9, h: 9 })).toEqual([{ x: 1, y: 1 }]);
  });
});

describe('boardAt', () => {
  it('boardAt(0) es la situación inicial', () => {
    const s = boardAt(room, 0);
    expect(s.pieces.find(p => p.id === 'b')!.invulnerable).toBe(true);
    expect(s.zones).toEqual([]);
  });
  it('boardAt aplica los cambios acumulados', () => {
    expect(boardAt(room, 1).pieces.find(p => p.id === 'b')!.cell).toEqual({ x: 4, y: 2 });
    expect(boardAt(room, 1).actor).toBe('c');
  });
  it('las zonas solo duran su paso', () => {
    expect(boardAt(room, 2).zones[0].cells).toHaveLength(12);
    expect(boardAt(room, 3).zones).toEqual([]);
  });
  it('remove, aura y counter', () => {
    const s = boardAt(room, 3);
    expect(s.pieces.map(p => p.id)).toEqual(['b', 'c']);
    expect(s.pieces[0].invulnerable).toBe(false);
    expect(s.counters).toEqual([{ id: 't', name: expect.anything(), value: '1' }]);
  });
  it('el paso se acota', () => {
    expect(boardAt(room, 99)).toEqual(boardAt(room, 3));
    expect(boardAt(room, -1)).toEqual(boardAt(room, 0));
  });
  it('move con path pinta la zona path', () => {
    const r: Room = { ...room, steps: [
      { text: n('0'), changes: [] },
      { text: n('1'), changes: [{ type: 'move', piece: 'b', to: { x: 4, y: 5 }, path: [{ x: 4, y: 4 }] }] },
    ] };
    expect(boardAt(r, 1).zones[0]).toEqual({ kind: 'path', cells: [{ x: 4, y: 4 }] });
  });
  it('move sin path o con path vacío no añade zona', () => {
    expect(boardAt(room, 1).zones).toEqual([]);
  });
  it('tiles persisten y null las limpia', () => {
    const r: Room = { ...room, steps: [
      { text: n('0'), changes: [] },
      { text: n('1'), changes: [{ type: 'tiles', cells: [{ x: 0, y: 0 }], color: 'red' }] },
      { text: n('2'), changes: [{ type: 'tiles', cells: [{ x: 0, y: 0 }], color: null }] },
    ] };
    expect(boardAt(r, 1).tiles['0,0']).toBe('red');
    expect(boardAt(r, 2).tiles['0,0']).toBeUndefined();
  });
  it('no muta la sala', () => {
    const copy = structuredClone(room);
    boardAt(room, 3);
    expect(room).toEqual(copy);
  });

  it('los contadores se actualizan en su sitio y se quitan sin reordenar', () => {
    const r: Room = { ...room, steps: [
      { text: n('0'), changes: [
        { type: 'counter', id: 'a', name: n('A'), value: '1' },
        { type: 'counter', id: 'b', name: n('B'), value: '1' },
        { type: 'counter', id: 'c', name: n('C'), value: '1' },
      ] },
      { text: n('1'), changes: [{ type: 'counter', id: 'a', name: n('A'), value: '2' }] },
      { text: n('2'), changes: [{ type: 'counter', id: 'b', name: n('B'), value: null }] },
    ] };
    expect(boardAt(r, 1).counters.map(c => `${c.id}${c.value}`)).toEqual(['a2', 'b1', 'c1']);
    expect(boardAt(r, 2).counters.map(c => c.id)).toEqual(['a', 'c']);
  });
});
