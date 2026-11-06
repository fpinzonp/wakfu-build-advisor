// Fichas de monstruos de la wiki para el simulador (public/data/mobs.json).

import type { Element } from '../game';

export interface Mob {
  name: string; family: string; type: string; minLevel: number; maxLevel: number;
  hp: [number, number]; ap: number; mp: number;
  res: Record<Element, [number, number]>;
}

export interface MobData { version: string; mobs: Mob[] }

export interface MobStats { hp: number; ap: number; mp: number; res: Record<Element, number> }

const lerp = ([a, b]: [number, number], t: number) => Math.round(a + (b - a) * t);

/** PV y resistencias del mob a un nivel, interpolando entre su nivel mínimo y máximo. */
export function mobAtLevel(m: Mob, level: number): MobStats {
  const span = m.maxLevel - m.minLevel;
  const t = span > 0 ? Math.min(1, Math.max(0, (level - m.minLevel) / span)) : 0;
  return {
    hp: lerp(m.hp, t), ap: m.ap, mp: m.mp,
    res: { fire: lerp(m.res.fire, t), water: lerp(m.res.water, t), earth: lerp(m.res.earth, t), air: lerp(m.res.air, t) },
  };
}
