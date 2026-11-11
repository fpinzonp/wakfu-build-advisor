import { describe, expect, it } from 'vitest';
import { DUNGEONS, EXCLUDED, byTier } from './index';
import { checkDungeon } from './validate';

describe('registro de mazmorras', () => {
  it.each(DUNGEONS.map(d => [d.id, d] as const))('%s es coherente', (_, d) => expect(checkDungeon(d)).toEqual([]));
  it('ids únicos', () => expect(new Set(DUNGEONS.map(d => d.id)).size).toBe(DUNGEONS.length));
  it('ids de sala únicos dentro de cada mazmorra', () => {
    for (const d of DUNGEONS) expect(new Set(d.rooms.map(r => r.id)).size).toBe(d.rooms.length);
  });
  it('una mazmorra no está a la vez incluida y excluida', () => {
    const ids = new Set(DUNGEONS.map(d => d.id));
    expect(EXCLUDED.filter(e => ids.has(e.id))).toEqual([]);
  });
  it('byTier agrupa y ordena', () => {
    const g = byTier();
    expect(g.map(x => x.tier[0])).toEqual([...g.map(x => x.tier[0])].sort((a, b) => a - b));
  });
  it('Tropikes tiene sala 1 y boss', () =>
    expect(DUNGEONS.find(d => d.id === 'tropikes')!.rooms.map(r => r.id)).toEqual(['room1', 'boss']));
  it('Poulpe: el boss deja de ser invulnerable al matar los 4 tentáculos', () => {
    const r = DUNGEONS.find(d => d.id === 'poulpe')!.rooms[0];
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(r.pieces.filter(p => p.id.startsWith('t')).length).toBe(4);
    expect(r.steps[r.steps.length - 1].changes).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Tour Minérale: las +300 res. caen al destruir los 4 cristales', () => {
    const r = DUNGEONS.find(d => d.id === 'tour-minerale')!.rooms.find(x => x.id === 'boss')!;
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(r.steps.flatMap(s => s.changes).filter(c => c.type === 'remove').length).toBe(4);
    expect(r.steps[r.steps.length - 1].changes).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  const room = (id: string, rid = 'room1') => DUNGEONS.find(d => d.id === id)!.rooms.find(x => x.id === rid)!;
  const last = (r: ReturnType<typeof room>) => r.steps[r.steps.length - 1].changes;
  const all = (r: ReturnType<typeof room>) => r.steps.flatMap(s => s.changes);
  it('Corbeau-Cave: el monstruo gana la aura de reflejo y la pierde con el hechizo de cura/boost', () => {
    const r = room('corbeau-cave');
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'mob1', on: true });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'mob1', on: false });
  });
  it('Excarnus: el boss empieza protegido, cae al desactivar el tótem y vuelve tras 3 turnos', () => {
    const r = room('excarnus', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it('Truchière: la invulnerabilidad del boss cae al matar todos los huevos', () => {
    const r = room('truchiere', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r).filter(c => c.type === 'remove').length).toBe(r.pieces.filter(p => p.id.startsWith('egg')).length);
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Scarrière: los 4 escarabajos existen y matar el de fuego quita la protección del boss', () => {
    const r = room('scarriere', 'boss');
    expect(r.pieces.filter(p => p.kind === 'mob').length).toBe(4);
    expect(all(r)).toContainEqual({ type: 'remove', piece: 'fire' });
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Slekymoses: el boss es invulnerable y deja de serlo tras el hechizo del Slek', () => {
    const r = room('slekymoses', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'label', piece: 'pj1', label: 'Slek' });
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
});
