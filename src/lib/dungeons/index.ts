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
import noirespore from './data/noirespore';
import potofeu from './data/potofeu';
import jawdin from './data/jawdin';
import sourceDuMal from './data/source-du-mal';
import waWabbit from './data/wa-wabbit';
import enutrosor from './data/enutrosor';
import lampionaute from './data/lampionaute';
import roubBar from './data/roub-bar';
import eBou from './data/e-bou';
import fabriqueMeka from './data/fabrique-meka';
import crocodailles from './data/crocodailles';
import gerbouille from './data/gerbouille';

// Orden: por tramo de nivel (mínimo) y luego por nombre francés.
export const DUNGEONS: Dungeon[] = [tropikes, poulpe, tourMinerale, corbeauCave, excarnus, truchiere, scarriere, slekymoses,
  magikRiktus, areneDansante, corbeauNoir, hagenGlass, smarrante, cacterre, dragonCochon,
  noirespore, potofeu, jawdin, sourceDuMal, waWabbit, enutrosor,
  lampionaute, roubBar, eBou, fabriqueMeka,
  crocodailles, gerbouille,
].sort(
  (a, b) => a.tier[0] - b.tier[0] || a.name.fr.localeCompare(b.name.fr, 'fr'),
);

// Mazmorras revisadas pero sin mecánica clara: no se animan.
export const EXCLUDED: Excluded[] = [
  {
    id: 'kannibouls',
    name: 'Donjon des Kannibouls',
    reason: 'La guía no dice si el tótem absorbido se consume, cuánto dura la vulnerabilidad (la imagen solo muestra «Vulnérabilité Aquatique» de 1 turno) ni cómo el estado de los personajes permite dañar a los invulnerables; la absorción del boss («zona de tótems» y reglas de 20 % por elemento) tampoco se concreta.',
  },
  {
    id: 'cite-interdite',
    name: 'Cité Interdite',
    reason: 'La guía dice que el boss es invulnerable al principio, pero nunca explica cómo se le quita; solo describe los 4 tonneaux (invulnerables a más de 3 PO) y la fase 2 tras matar 2.',
  },
  {
    id: 'kannivores',
    name: 'Donjon des Kannivores',
    reason: 'La invulnerabilidad del boss dura 1 turno en cada cambio de fase y es automática; no hay una mecánica de los jugadores para quitarla. Las raíces solo reducen el daño un 25 % cada una, sin un paso a paso concreto.',
  },
];

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
