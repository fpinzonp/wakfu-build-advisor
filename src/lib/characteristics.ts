// Ficha de características completa de una build (como la del juego).
import { BUILD_SLOTS, ELEMENTS, type Element } from './game';
import type { BuildResult } from './optimizer';

export interface ElementLine { element: Element; mastery: number; res: number; resPct: number }

export interface Sheet {
  elements: ElementLine[];
  stats: Record<string, number>;   // resto de características (claves de STAT_LABELS)
}

const MAST_KEY: Record<Element, string> = { fire: 'mastFire', water: 'mastWater', earth: 'mastEarth', air: 'mastAir' };
const RES_KEY: Record<Element, string> = { fire: 'resFire', water: 'resWater', earth: 'resEarth', air: 'resAir' };

/** % de reducción de daño en Wakfu: 1 - 0,8^(resistencia/100), con tope del 90 %. */
export const resistancePct = (res: number) => Math.min(90, (1 - Math.pow(0.8, res / 100)) * 100);

/**
 * @param elements elementos de la build: reciben primero el "dominio en N elementos" aleatorio.
 * Las "resistencias en N elementos" se asignan a los elementos con menos resistencia.
 */
export function buildSheet(result: BuildResult, elements: Element[]): Sheet {
  const t = result.totals;
  const order = [...elements, ...ELEMENTS.map((e) => e.id).filter((e) => !elements.includes(e))];
  const mastery = Object.fromEntries(order.map((e) => [e, (t.mastElem ?? 0) + (t[MAST_KEY[e]] ?? 0)])) as Record<Element, number>;
  const res = Object.fromEntries(order.map((e) => [e, (t.resElem ?? 0) + (t[RES_KEY[e]] ?? 0)])) as Record<Element, number>;

  for (const { id } of BUILD_SLOTS) {
    const item = result.slots[id];
    if (item?.multiMast) for (const e of order.slice(0, item.multiMast.n)) mastery[e] += item.multiMast.v;
    if (item?.multiRes) {
      const lowest = [...order].sort((a, b) => res[a] - res[b]).slice(0, item.multiRes.n);
      for (const e of lowest) res[e] += item.multiRes.v;
    }
  }

  return {
    elements: ELEMENTS.map(({ id }) => ({ element: id, mastery: mastery[id], res: res[id], resPct: resistancePct(res[id]) })),
    stats: { control: 1, ...t },
  };
}
