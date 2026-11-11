import type { Dungeon, Excluded } from './types';
import tropikes from './data/tropikes';
import poulpe from './data/poulpe';
import tourMinerale from './data/tour-minerale';

// Orden: por tramo de nivel (mínimo) y luego por nombre francés.
export const DUNGEONS: Dungeon[] = [tropikes, poulpe, tourMinerale].sort(
  (a, b) => a.tier[0] - b.tier[0] || a.name.fr.localeCompare(b.name.fr, 'fr'),
);

// Mazmorras revisadas pero sin mecánica clara: no se animan.
export const EXCLUDED: Excluded[] = [];

// Agrupa por tramo de nivel, en orden ascendente.
export function byTier(list: Dungeon[] = DUNGEONS): { tier: [number, number]; dungeons: Dungeon[] }[] {
  const groups = new Map<string, { tier: [number, number]; dungeons: Dungeon[] }>();
  for (const d of list) {
    const key = `${d.tier[0]}-${d.tier[1]}`;
    const g = groups.get(key) ?? { tier: d.tier, dungeons: [] };
    g.dungeons.push(d);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.tier[0] - b.tier[0] || a.tier[1] - b.tier[1]);
}
