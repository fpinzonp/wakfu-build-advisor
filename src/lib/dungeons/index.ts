import type { Dungeon, Excluded } from './types';
import tropikes from './data/tropikes';
import poulpe from './data/poulpe';
import tourMinerale from './data/tour-minerale';
import corbeauCave from './data/corbeau-cave';
import excarnus from './data/excarnus';
import truchiere from './data/truchiere';
import scarriere from './data/scarriere';
import slekymoses from './data/slekymoses';
import magikRiktus from './data/magik-riktus';
import areneDansante from './data/arene-dansante';
import corbeauNoir from './data/corbeau-noir';
import hagenGlass from './data/hagen-glass';
import smarrante from './data/smarrante';
import cacterre from './data/cacterre';
import dragonCochon from './data/dragon-cochon';

// Orden: por tramo de nivel (mínimo) y luego por nombre francés.
export const DUNGEONS: Dungeon[] = [tropikes, poulpe, tourMinerale, corbeauCave, excarnus, truchiere, scarriere, slekymoses,
  magikRiktus, areneDansante, corbeauNoir, hagenGlass, smarrante, cacterre, dragonCochon,
].sort(
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
