import { describe, expect, it } from 'vitest';
import { DUNGEONS, EXCLUDED, byTier } from './index';
import { REQUIREMENTS, PENDING, needsOf } from './requirements';
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
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
    expect(last(r)).toContainEqual({ type: 'counter', id: 'turns', name: expect.anything(), value: null });
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
  it('Noirespore: Sepolourpode invulnerables hasta matar a los demás; boss fase 1 cae al matar la invocación; fase 2 espera 2 turnos', () => {
    const r1 = room('noirespore');
    for (const id of ['sepo1', 'sepo2', 'sepo3']) {
      expect(r1.pieces.find(p => p.id === id)!.invulnerable).toBe(true);
      expect(last(r1)).toContainEqual({ type: 'aura', piece: id, on: false });
    }
    const b1 = room('noirespore', 'boss1');
    expect(all(b1)).toContainEqual({ type: 'remove', piece: 'summon' });
    expect(all(b1)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    const b2 = room('noirespore', 'boss2');
    expect(b2.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(b2)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'wait', value: '2/2' }));
    expect(all(b2)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Potofeu: el veneno se transmite 2 veces al boss y cae la invulnerabilidad', () => {
    const r = room('potofeu', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r).filter(c => c.type === 'aura' && c.piece === 'boss' && !c.on).length).toBe(2);
    expect(all(r)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'times', value: '2/2' }));
  });
  it('Jawdin: la Cawotte a 1 PV explota con el boss dentro y le quita la invulnerabilidad 1 turno', () => {
    const r = room('jawdin', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'remove', piece: 'c1' });
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it('Source du Mal: matar el Bulbiflore deja el glifo oscuro y «Mort Subite» quita la invulnerabilidad', () => {
    const r = room('source-du-mal', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'remove', piece: 'bulbiflore' });
    expect(all(r)).toContainEqual(expect.objectContaining({ type: 'tiles', color: 'dark' }));
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it('Wa Wabbit: el Wobot muere normal, los 3 Wabbits necesitan logo y luego cae el boss', () => {
    const r = room('wa-wabbit', 'boss');
    expect(r.pieces.find(p => p.id === 'wobot')!.invulnerable).toBeFalsy();
    for (const id of ['w1', 'w2', 'w3', 'boss']) {
      expect(r.pieces.find(p => p.id === id)!.invulnerable).toBe(true);
      expect(all(r)).toContainEqual({ type: 'aura', piece: id, on: false });
    }
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Enutrosor: las +400 res. bajan al dañar el diamante y matar una gema da ×5; el boss igual', () => {
    const r = room('enutrosor');
    expect(r.pieces.find(p => p.id === 'm1')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'remove', piece: 'gem1' });
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'm1', on: false });
    const b = room('enutrosor', 'boss');
    expect(b.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(b)).toContainEqual({ type: 'remove', piece: 'gem1' });
    expect(all(b)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(b)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'x5', value: null }));
  });
  it('Lampionaute: Foudroyé + desplazamiento inverso junto a Javého quita la invulnerabilidad 1 turno', () => {
    const r = room('lampionaute', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it("Roub'Bar: el muro de pólvora quita la +300 res. en la sala 1 y la invulnerabilidad del boss", () => {
    const r1 = room('roub-bar', 'room1');
    expect(r1.pieces.find(p => p.id === 'm1')!.invulnerable).toBe(true);
    expect(all(r1)).toContainEqual({ type: 'aura', piece: 'm1', on: false });
    expect(last(r1)).toContainEqual({ type: 'aura', piece: 'm1', on: true });
    const b = room('roub-bar', 'boss');
    expect(b.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(b)).toContainEqual(expect.objectContaining({ type: 'tiles', color: 'red' }));
    expect(all(b)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('E-Bou: fase 1 pasa las casillas azules a rojas; fase 3 resetea las rojas y saca al boss del centro', () => {
    const p1 = room('e-bou', 'phase1');
    expect(p1.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(p1.tiles![0].color).toBe('blue');
    expect(all(p1).filter(c => c.type === 'tiles' && c.color === 'red').length).toBe(p1.tiles![0].cells.length);
    expect(last(p1)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    const p3 = room('e-bou', 'phase3');
    expect(p3.tiles!.some(t => t.color === 'red')).toBe(true);
    expect(all(p3).filter(c => c.type === 'tiles' && c.color === 'blue').length).toBe(2);
    expect(all(p3)).toContainEqual(expect.objectContaining({ type: 'move', piece: 'boss' }));
    expect(all(p3)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Fabrique Méka: empezar el turno en el glifo oscuro da +50 % y baja la protección en sala 1 y boss', () => {
    const r = room('fabrique-meka');
    for (const id of ['m1', 'm2', 'm3']) {
      expect(r.pieces.find(p => p.id === id)!.invulnerable).toBe(true);
      expect(all(r)).toContainEqual({ type: 'aura', piece: id, on: false });
    }
    expect(r.tiles![0].color).toBe('dark');
    const b = room('fabrique-meka', 'boss');
    expect(b.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(b)).toContainEqual(expect.objectContaining({ type: 'counter', id: 'bonus', value: '+50 %' }));
    expect(all(b)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
    expect(last(b)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
  });
  it('Crocodailles: 3 monstruos pierden el +500 res. por colisión; el boss se vuelve invulnerable al 55 % y cae con otra colisión', () => {
    const r = room('crocodailles');
    for (const id of ['mob1', 'mob2', 'mob3']) {
      expect(r.pieces.find(p => p.id === id)!.invulnerable).toBe(true);
      expect(all(r)).toContainEqual({ type: 'aura', piece: id, on: false });
    }
    expect(all(r).filter(c => c.type === 'zone' && c.zone.kind === 'collision').length).toBe(3);
    const b = room('crocodailles', 'boss');
    expect(b.pieces.find(p => p.id === 'boss')!.invulnerable).toBeFalsy();
    expect(all(b)).toContainEqual({ type: 'aura', piece: 'boss', on: true });
    expect(all(b)).toContainEqual(expect.objectContaining({ type: 'zone', zone: expect.objectContaining({ kind: 'collision' }) }));
    expect(last(b)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Gerbouille: Conductor, 8 burbujas que se limpian con dos golpes cuerpo a cuerpo y el boss queda con 2 PW', () => {
    const r = room('gerbouille', 'boss');
    expect(r.pieces.find(p => p.id === 'boss')!.invulnerable).toBe(true);
    expect(all(r)).toContainEqual({ type: 'label', piece: 'pj1', label: '⚡' });
    const puestas = all(r).filter(c => c.type === 'tiles' && c.color === 'blue').flatMap(c => (c.type === 'tiles' ? c.cells : []));
    expect(puestas.length).toBe(8);
    const quitadas = all(r).filter(c => c.type === 'tiles' && c.color === null).flatMap(c => (c.type === 'tiles' ? c.cells : []));
    expect(new Set(quitadas.map(c => `${c.x},${c.y}`))).toEqual(new Set(puestas.map(c => `${c.x},${c.y}`)));
    expect(all(r).filter(c => c.type === 'zone' && c.zone.kind === 'hit').length).toBe(2);
    expect(all(r)).toContainEqual({ type: 'label', piece: 'boss', label: '+2 PW' });
    expect(last(r)).toContainEqual({ type: 'aura', piece: 'boss', on: false });
  });
  it('Kannibouls, Cité Interdite y Kannivores están excluidas con motivo', () => {
    for (const id of ['kannibouls', 'cite-interdite', 'kannivores']) expect(EXCLUDED.find(e => e.id === id)?.reason.length).toBeGreaterThan(20);
  });
  it('todas las mazmorras: frases de paso de 120 caracteres como máximo en los 3 idiomas', () => {
    const largas: string[] = [];
    for (const d of DUNGEONS)
      for (const r of d.rooms) for (const [i, st] of r.steps.entries()) for (const l of ['es', 'en', 'fr'] as const)
        if (st.text[l].length > 120) largas.push(`${d.id}/${r.id} paso ${i} ${l} (${st.text[l].length}): ${st.text[l]}`);
    expect(largas).toEqual([]);
  });
  it('todas las mazmorras: label y valores de contador sin palabras (no se traducen)', () => {
    // Lista blanca mínima: "Slek" es el nombre propio con el que se rotula a un personaje en slekymoses.
    const permitidos = new Set(['Slek']);
    const malos: string[] = [];
    for (const d of DUNGEONS)
      for (const r of d.rooms) {
        const textos = [
          ...r.pieces.flatMap(p => (p.label ? [p.label] : [])),
          ...r.steps.flatMap(st => st.changes.flatMap(c =>
            c.type === 'label' && c.label ? [c.label] : c.type === 'counter' && c.value ? [c.value] : [])),
        ];
        for (const t of textos) if (/[A-Za-zÀ-ÿ]{3,}/.test(t) && !permitidos.has(t)) malos.push(`${d.id}/${r.id}: ${t}`);
      }
    expect(malos).toEqual([]);
  });
});

describe('exigencias', () => {
  const ids = DUNGEONS.map(d => d.id);
  it('cada mazmorra tiene entrada y no sobran entradas', () => {
    expect(Object.keys(REQUIREMENTS).sort()).toEqual([...ids].sort());
  });
  it('PENDING solo contiene ids de DUNGEONS', () => {
    for (const id of PENDING) expect(ids).toContain(id);
  });
  it('needsOf lanza si no hay entrada', () => {
    expect(() => needsOf('no-existe')).toThrow();
    expect(needsOf(ids[0])).toBe(REQUIREMENTS[ids[0]]);
  });
  it('size ∈ {3, 4, 6}', () => {
    for (const id of ids) expect([3, 4, 6]).toContain(REQUIREMENTS[id].size);
  });
  it('why con es, en y fr no vacíos', () => {
    for (const id of ids) for (const r of REQUIREMENTS[id].reqs)
      for (const l of ['es', 'en', 'fr'] as const) expect(r.why[l].trim()).not.toBe('');
  });
  // Tramo 36-110 (Task 5a): ya curadas.
  const CURATED = ['poulpe', 'tour-minerale', 'corbeau-cave', 'excarnus', 'truchiere',
    'scarriere', 'slekymoses', 'arene-dansante', 'corbeau-noir', 'magik-riktus'];
  it.each(CURATED)('%s ya no está pendiente de curar', (id) => {
    expect(PENDING.has(id)).toBe(false);
  });
  it('place solo con need place; count ≥ 1', () => {
    for (const id of ids) for (const r of REQUIREMENTS[id].reqs) {
      if (r.place !== undefined) expect(r.need).toBe('place');
      if (r.count !== undefined) expect(r.count).toBeGreaterThanOrEqual(1);
    }
  });
});
