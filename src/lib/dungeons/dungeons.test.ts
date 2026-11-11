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
  it('Magik Riktus: el boss empieza invulnerable, 3 sombreros y deja de serlo', () => {
    const r = room('magik-riktus', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r).filter(c => c.type === 'add').length).toBe(3);
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Arène Dansante: el boss refleja y deja de hacerlo al golpearlo desde la PO exacta', () => {
    const r = room('arene-dansante', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Corbeau Noir: matar un corbac permite quitar la invulnerabilidad un turno', () => {
    const r = room('corbeau-noir', 'boss');
    expect(all(r)).toContainEqual({ type: 'remove', piece: 'corbac' });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Hagen-Glass: la armadura de hielo cae al quitar PA', () => {
    const r = room('hagen-glass');
    expect(r.pieces.find(p => p.id === 'mob1')!.invulnerable).toBe(true);
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'mob1', on: false });
  });
  it('Smarrante: el golpe cuerpo a cuerpo quita la invulnerabilidad solo durante su turno', () => {
    const r = room('smarrante', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it('Cacterre: 4 contadores de elemento llegan a 10/10 y cae la invulnerabilidad', () => {
    const r = room('cacterre', 'boss');
    expect(all(r).filter(c => c.type === 'counter' && c.value === '10/10').length).toBe(4);
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Dragon-Cochon: fase 1 (30 PA) y fase 2 (frenesí 7) quitan la invulnerabilidad', () => {
    const p1 = room('dragon-cochon', 'phase1');
    const p2 = room('dragon-cochon', 'phase2');
    for (const r of [p1, p2]) {
      expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
      expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    }
    expect(all(p1)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'back', value: '30/30' }));
    expect(all(p2)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'frenzy', value: '7/7' }));
  });
  it('tramo 96-125: frases de paso de 120 caracteres como máximo en los 3 idiomas', () => {
    const ids = ['magik-riktus', 'arene-dansante', 'corbeau-noir', 'hagen-glass', 'smarrante', 'cacterre', 'dragon-cochon'];
    const largas: string[] = [];
    for (const d of DUNGEONS.filter(x => ids.includes(x.id)))
      for (const r of d.rooms) for (const st of r.steps) for (const l of ['es', 'en', 'fr'] as const)
        if (st.text[l].length > 120) largas.push(`${d.id}/${r.id} ${l} (${st.text[l].length}): ${st.text[l]}`);
    expect(largas).toEqual([]);
  });
});
