// Guardar y compartir builds: todo cabe en un código que va en el enlace (#b=…), sin servidor.
import { BUILD_SLOTS, type BuildSlot, type Element, type Item, type Role } from './game';
import type { BuildSlots } from './optimizer';

/** Runas y sublimaciones elegidas por el usuario. */
export interface EnchantState {
  // Runa por engarce (id o null = vacío); itemId evita aplicar runas de una pieza que ya cambió.
  runes: Partial<Record<BuildSlot, { itemId: number; shards: (number | null)[] }>>;
  subs: Partial<Record<BuildSlot, number>>;   // sublimación normal por pieza
  epic?: number | null;                       // undefined = aún sin elegir (se propone la sugerida); null = ninguna
  relic?: number | null;
}

export const EMPTY_ENCHANT: EnchantState = { runes: {}, subs: {} };

export interface BuildSettings {
  level: number; classId: string; role: Role; elements: Element[];
  targets: { ap: number; mp: number; range: number };
  rarities: number[]; minLevel: number; craftOnly: boolean;
  berserk: boolean; crit: boolean; back: boolean;
  excluded: number[];
}

export interface SavedBuild {
  settings: BuildSettings;
  slots: Partial<Record<BuildSlot, number>>;  // id de objeto por ranura
  locked: BuildSlot[];
  enchant: EnchantState;
}

// Claves cortas para que el enlace no sea enorme.
interface Packed {
  v: 1;
  s: [number, string, Role, Element[], number, number, number, number[], number, 0 | 1, 0 | 1, 0 | 1, 0 | 1, number[]];
  i: Partial<Record<BuildSlot, number>>;
  k: BuildSlot[];
  r: Partial<Record<BuildSlot, (number | null)[]>>;
  u: Partial<Record<BuildSlot, number>>;
  e?: number | null;
  q?: number | null;
}

const b = (x: boolean) => (x ? 1 : 0) as 0 | 1;

export function encodeBuild(build: SavedBuild): string {
  const { settings: s } = build;
  const packed: Packed = {
    v: 1,
    s: [s.level, s.classId, s.role, s.elements, s.targets.ap, s.targets.mp, s.targets.range, s.rarities, s.minLevel,
      b(s.craftOnly), b(s.berserk), b(s.crit), b(s.back), s.excluded],
    i: build.slots,
    k: build.locked,
    r: Object.fromEntries(Object.entries(build.enchant.runes).map(([slot, r]) => [slot, r!.shards])),
    u: build.enchant.subs,
    e: build.enchant.epic,
    q: build.enchant.relic,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(packed));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBuild(code: string): SavedBuild | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Packed;
    if (p.v !== 1) return null;
    const [level, classId, role, elements, ap, mp, range, rarities, minLevel, craftOnly, berserk, crit, back, excluded] = p.s;
    const runes: EnchantState['runes'] = {};
    for (const [slot, shards] of Object.entries(p.r ?? {})) {
      const itemId = p.i[slot as BuildSlot];
      if (itemId !== undefined && shards) runes[slot as BuildSlot] = { itemId, shards };
    }
    return {
      settings: {
        level, classId, role, elements, targets: { ap, mp, range }, rarities, minLevel,
        craftOnly: !!craftOnly, berserk: !!berserk, crit: !!crit, back: !!back, excluded,
      },
      slots: p.i, locked: p.k ?? [],
      enchant: { runes, subs: p.u ?? {}, epic: p.e, relic: p.q },
    };
  } catch {
    return null;
  }
}

export const slotIds = (slots: BuildSlots) =>
  Object.fromEntries(BUILD_SLOTS.flatMap((s) => (slots[s.id] ? [[s.id, slots[s.id]!.id]] : [])));

export function slotsFromIds(ids: Partial<Record<BuildSlot, number>>, items: Item[]): BuildSlots {
  const byId = new Map(items.map((i) => [i.id, i]));
  const slots: BuildSlots = {};
  for (const [slot, id] of Object.entries(ids)) {
    const item = byId.get(id!);
    if (item) slots[slot as BuildSlot] = item;
  }
  return slots;
}

export const shareUrl = (code: string) => `${location.origin}${location.pathname}#b=${code}`;

export function readHashCode(): string | null {
  const m = location.hash.match(/^#b=([\w-]+)$/);
  return m ? m[1] : null;
}

// Builds guardadas en este navegador.
const STORE_KEY = 'wba.builds';

export interface StoredBuild { id: string; name: string; date: string; code: string; summary: string }

export function loadStored(): StoredBuild[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as StoredBuild[];
  } catch {
    return [];
  }
}

export function saveStored(list: StoredBuild[]): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
