import type { Cell } from '../sim/formulas';
import type { L10n, Piece, Room, TileColor, Zone, ZoneKind } from './types';

export interface BoardState {
  pieces: Piece[]; // en el orden de aparición, sin las quitadas
  tiles: Record<string, TileColor>; // clave `${x},${y}`
  zones: { kind: ZoneKind; cells: Cell[] }[]; // solo las del paso actual, ya expandidas
  counters: { id: string; name: L10n; value: string }[];
  actor?: string;
  text: L10n;
}

const inBoard = (c: Cell, size: { w: number; h: number }) => c.x >= 0 && c.y >= 0 && c.x < size.w && c.y < size.h;

// Expande una zona a casillas: rombo Manhattan (center + radius) o lista explícita, recortado al tablero.
export function zoneCells(zone: Zone, size: { w: number; h: number }): Cell[] {
  const out: Cell[] = [];
  if (zone.center && zone.radius !== undefined) {
    const c = zone.center, r = zone.radius;
    for (let dx = -r; dx <= r; dx++) {
      const rest = r - Math.abs(dx);
      for (let dy = -rest; dy <= rest; dy++) out.push({ x: c.x + dx, y: c.y + dy });
    }
  }
  for (const c of zone.cells ?? []) out.push({ ...c });
  return out.filter(c => inBoard(c, size));
}

// Estado del tablero tras aplicar los pasos 0..step (acotado al rango válido). No muta la sala.
export function boardAt(room: Room, step: number): BoardState {
  const last = room.steps.length - 1;
  const idx = Math.max(0, Math.min(step, last));
  let pieces: Piece[] = room.pieces.map(p => ({ ...p, cell: { ...p.cell } }));
  const tiles: Record<string, TileColor> = {};
  for (const t of room.tiles ?? []) for (const c of t.cells) tiles[`${c.x},${c.y}`] = t.color;
  let zones: BoardState['zones'] = [];
  let counters: BoardState['counters'] = [];

  for (let i = 0; i <= idx; i++) {
    zones = [];
    for (const ch of room.steps[i].changes) {
      switch (ch.type) {
        case 'move':
          pieces = pieces.map(p => (p.id === ch.piece ? { ...p, cell: { ...ch.to } } : p));
          if (ch.path && ch.path.length > 0) zones.push({ kind: 'path', cells: zoneCells({ kind: 'path', cells: ch.path }, room.size) });
          break;
        case 'aura':
          pieces = pieces.map(p => (p.id === ch.piece ? { ...p, invulnerable: ch.on } : p));
          break;
        case 'label':
          pieces = pieces.map(p => {
            if (p.id !== ch.piece) return p;
            const { label: _l, ...rest } = p;
            return ch.label === null ? rest : { ...rest, label: ch.label };
          });
          break;
        case 'remove':
          pieces = pieces.filter(p => p.id !== ch.piece);
          break;
        case 'add':
          pieces = [...pieces, { ...ch.piece, cell: { ...ch.piece.cell } }];
          break;
        case 'zone':
          zones.push({ kind: ch.zone.kind, cells: zoneCells(ch.zone, room.size) });
          break;
        case 'tiles':
          for (const c of ch.cells) {
            const k = `${c.x},${c.y}`;
            if (ch.color === null) delete tiles[k];
            else tiles[k] = ch.color;
          }
          break;
        case 'counter':
          counters = counters.filter(c => c.id !== ch.id);
          if (ch.value !== null) counters.push({ id: ch.id, name: ch.name, value: ch.value });
          break;
      }
    }
  }
  const cur = room.steps[idx];
  return { pieces, tiles, zones, counters, actor: cur?.actor, text: cur?.text };
}
