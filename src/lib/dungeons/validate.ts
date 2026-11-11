import type { Cell } from '../sim/formulas';
import type { Dungeon, L10n } from './types';

const LANG_KEYS = ['es', 'en', 'fr'] as const;

// Comprueba que un archivo de mazmorra escrito a mano sea coherente. Lista vacía = todo bien.
export function checkDungeon(d: Dungeon): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where} ${msg}`.replace(/\s+/g, ' ').trim());

  const l10n = (where: string, label: string, v: L10n | undefined) => {
    const missing = LANG_KEYS.filter(l => !v || typeof v[l] !== 'string' || v[l].trim() === '');
    if (missing.length) err(where, `falta traducción en ${label} (${missing.join(', ')})`);
  };

  l10n(d.id, 'el nombre de la mazmorra', d.name);

  const [min, max] = d.tier;
  if (!(Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max <= 230 && min <= max)) {
    err(d.id, `tramo de nivel inválido [${min}, ${max}] (debe ser 1-230 con mínimo <= máximo)`);
  }
  if (typeof d.guide !== 'string' || !d.guide.startsWith('https://')) err(d.id, 'guía debe ser un enlace que empiece por https://');
  if (d.rooms.length === 0) err(d.id, 'sin salas');

  for (const room of d.rooms) {
    const rw = `${d.id}/${room.id}`;
    const { w, h } = room.size;
    const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h;
    const checkCell = (where: string, label: string, c: Cell) => {
      if (!inside(c)) err(where, `${label} (${c.x},${c.y}) fuera del tablero ${w}x${h}`);
    };

    l10n(rw, 'el nombre de la sala', room.name);
    l10n(rw, 'la condición', room.condition);
    l10n(rw, 'la duración', room.duration);

    // Piezas vivas (id -> casilla); `seen` recuerda todos los ids usados, también los quitados.
    const alive = new Map<string, Cell>();
    const seen = new Set<string>();
    const addPiece = (where: string, p: Dungeon['rooms'][number]['pieces'][number]) => {
      if (seen.has(p.id)) err(where, `id repetido "${p.id}"`);
      seen.add(p.id);
      alive.set(p.id, { ...p.cell });
      l10n(where, `el nombre de la pieza ${p.id}`, p.name);
      if (p.role) l10n(where, `el rol de la pieza ${p.id}`, p.role);
      checkCell(where, `pieza ${p.id}`, p.cell);
    };

    for (const p of room.pieces) addPiece(rw, p);
    for (const t of room.tiles ?? []) for (const c of t.cells) checkCell(rw, 'casilla de suelo', c);

    // Casillas ocupadas por más de una pieza en el estado actual.
    const checkOverlap = (where: string) => {
      const byCell = new Map<string, string[]>();
      for (const [id, c] of alive) {
        const k = `${c.x},${c.y}`;
        byCell.set(k, [...(byCell.get(k) ?? []), id]);
      }
      for (const [k, ids] of byCell) if (ids.length > 1) err(where, `piezas en la misma casilla (${k}): ${ids.join(', ')}`);
    };
    checkOverlap(rw);

    if (room.steps.length === 0) {
      err(rw, 'sala sin pasos');
      continue;
    }

    room.steps.forEach((step, i) => {
      const sw = `${rw} paso ${i}`;
      l10n(sw, 'el texto', step.text);
      if (i === 0 && step.changes.length > 0) err(sw, 'el paso 0 es el estado inicial y no puede tener cambios');

      const known = (id: string) => {
        if (!alive.has(id)) err(sw, `pieza desconocida o ya quitada "${id}"`);
      };
      const before = new Set(alive.keys());

      for (const ch of step.changes) {
        switch (ch.type) {
          case 'move':
            known(ch.piece);
            checkCell(sw, 'destino', ch.to);
            for (const c of ch.path ?? []) checkCell(sw, 'camino', c);
            if (alive.has(ch.piece)) alive.set(ch.piece, { ...ch.to });
            break;
          case 'aura':
          case 'label':
            known(ch.piece);
            break;
          case 'remove':
            known(ch.piece);
            alive.delete(ch.piece);
            break;
          case 'add':
            addPiece(sw, ch.piece);
            break;
          case 'zone':
            for (const c of ch.zone.cells ?? []) checkCell(sw, 'zona', c);
            if (ch.zone.center) checkCell(sw, 'centro de zona', ch.zone.center);
            break;
          case 'tiles':
            for (const c of ch.cells) checkCell(sw, 'casilla de suelo', c);
            break;
          case 'counter':
            l10n(sw, `el contador ${ch.id}`, ch.name);
            break;
        }
      }

      // El actor puede haberse quitado o añadido en este mismo paso.
      if (step.actor !== undefined && !before.has(step.actor) && !alive.has(step.actor)) {
        err(sw, `pieza desconocida o ya quitada "${step.actor}" (actor)`);
      }
      checkOverlap(sw);
    });
  }
  return errors;
}
