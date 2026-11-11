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
});
