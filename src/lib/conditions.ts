// Condiciones para equipar un objeto (de wakfu.wiki.gg): umbrales de características, objeto necesario
// (p. ej. la espada de nación exige su anillo), clase, y requisitos que la app no puede comprobar
// (rango de tropa, puntos de ciudadano, misiones).
import { CLASSES, STAT_LABELS, type Item } from './game';
import { fmt, t } from './i18n';

export type Cond =
  | { s: string; min?: number; max?: number }
  | { needs: number }
  | { cls: string }
  | { x: 'troupe' | 'citizen' | 'quest' | 'raw'; v: string | number };

// Objetos por id para nombrar el objeto necesario (los nombres siguen el idioma de la interfaz).
let byId = new Map<number, Item>();
export function registerItems(items: Item[]) {
  if (byId.size !== items.length) byId = new Map(items.map((i) => [i.id, i]));
}
export const itemById = (id: number) => byId.get(id);

/** Texto de una condición, p. ej. "Placaje entre 500 y 600" o "Requiere Anillo de Amakna equipado". */
export function condLabel(c: Cond): string {
  if ('s' in c) {
    const stat = STAT_LABELS[c.s] ?? c.s;
    if (c.min !== undefined && c.max !== undefined) return t('cond.between', { stat, min: fmt(c.min), max: fmt(c.max) });
    if (c.min !== undefined) return t('cond.min', { stat, v: fmt(c.min) });
    return t('cond.max', { stat, v: fmt(c.max ?? 0) });
  }
  if ('needs' in c) return t('cond.needs', { item: byId.get(c.needs)?.name ?? `#${c.needs}` });
  if ('cls' in c) return t('cond.cls', { cls: CLASSES.find((x) => x.id === c.cls)?.label ?? c.cls });
  if (c.x === 'troupe') return t('cond.troupe', { v: c.v });
  if (c.x === 'citizen') return t('cond.citizen', { v: fmt(Number(c.v)) });
  if (c.x === 'quest') return t('cond.quest', { v: c.v });
  return String(c.v);
}

/** Condiciones que la app comprueba (las demás solo se muestran como aviso). */
export const isCheckable = (c: Cond) => !('x' in c);

export interface CondState { equipped: (id: number) => boolean; total: (stat: string) => number | undefined; classId: string }

/** ¿Se cumple la condición? `undefined` si no se puede comprobar. */
export function condMet(c: Cond, st: CondState): boolean | undefined {
  if ('s' in c) {
    const v = st.total(c.s);
    if (v === undefined) return undefined;
    return (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);
  }
  if ('needs' in c) return st.equipped(c.needs);
  if ('cls' in c) return c.cls === st.classId;
  return undefined;
}

/** Primera condición incumplida de las piezas equipadas, como motivo legible; null si todo se cumple. */
export function condConflict(items: (Item | undefined)[], st: CondState): string | null {
  for (const item of items) {
    for (const c of item?.cond ?? []) {
      if (condMet(c, st) !== false) continue;
      if ('s' in c) {
        return t('cond.unmet', { item: item!.name, cond: condLabel(c), v: fmt(st.total(c.s) ?? 0) });
      }
      return t('cond.unmetPlain', { item: item!.name, cond: condLabel(c) });
    }
  }
  return null;
}
