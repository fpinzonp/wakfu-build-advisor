import type { Need, PlaceKind } from '../teams';
import type { L10n } from './types';

export interface Requirement {
  need: Need;
  required: boolean;      // true = obligatoria; false = recomendada
  level?: 1 | 2 | 3;      // por defecto 2
  count?: number;         // personajes distintos que deben cumplirla; por defecto 1
  place?: PlaceKind;      // solo con need 'place'; ausente = cualquier subtipo
  why: L10n;              // motivo visible
}

export interface DungeonNeeds { size: 3 | 4 | 6; reqs: Requirement[] }

// Ids aún sin curar; las tareas de curación los van quitando.
export const PENDING = new Set<string>([
  'poulpe',
  'tour-minerale',
  'excarnus',
  'corbeau-cave',
  'truchiere',
  'slekymoses',
  'scarriere',
  'corbeau-noir',
  'arene-dansante',
  'magik-riktus',
  'dragon-cochon',
  'smarrante',
  'cacterre',
  'hagen-glass',
  'potofeu',
  'jawdin',
  'noirespore',
  'wa-wabbit',
  'enutrosor',
  'source-du-mal',
  'e-bou',
  'fabrique-meka',
  'lampionaute',
  'roub-bar',
  'crocodailles',
  'tropikes',
  'gerbouille',
]);

export const REQUIREMENTS: Record<string, DungeonNeeds> = {
  'poulpe': { size: 6, reqs: [] }, // pendiente de curar
  'tour-minerale': { size: 6, reqs: [] }, // pendiente de curar
  'excarnus': { size: 6, reqs: [] }, // pendiente de curar
  'corbeau-cave': { size: 6, reqs: [] }, // pendiente de curar
  'truchiere': { size: 6, reqs: [] }, // pendiente de curar
  'slekymoses': { size: 6, reqs: [] }, // pendiente de curar
  'scarriere': { size: 6, reqs: [] }, // pendiente de curar
  'corbeau-noir': { size: 6, reqs: [] }, // pendiente de curar
  'arene-dansante': { size: 6, reqs: [] }, // pendiente de curar
  'magik-riktus': { size: 6, reqs: [] }, // pendiente de curar
  'dragon-cochon': { size: 6, reqs: [] }, // pendiente de curar
  'smarrante': { size: 6, reqs: [] }, // pendiente de curar
  'cacterre': { size: 6, reqs: [] }, // pendiente de curar
  'hagen-glass': { size: 6, reqs: [] }, // pendiente de curar
  'potofeu': { size: 6, reqs: [] }, // pendiente de curar
  'jawdin': { size: 6, reqs: [] }, // pendiente de curar
  'noirespore': { size: 6, reqs: [] }, // pendiente de curar
  'wa-wabbit': { size: 6, reqs: [] }, // pendiente de curar
  'enutrosor': { size: 6, reqs: [] }, // pendiente de curar
  'source-du-mal': { size: 6, reqs: [] }, // pendiente de curar
  'e-bou': { size: 6, reqs: [] }, // pendiente de curar
  'fabrique-meka': { size: 6, reqs: [] }, // pendiente de curar
  'lampionaute': { size: 6, reqs: [] }, // pendiente de curar
  'roub-bar': { size: 6, reqs: [] }, // pendiente de curar
  'crocodailles': { size: 6, reqs: [] }, // pendiente de curar
  'tropikes': { size: 6, reqs: [] }, // pendiente de curar
  'gerbouille': { size: 6, reqs: [] }, // pendiente de curar
};

export const needsOf = (id: string): DungeonNeeds => {
  const n = REQUIREMENTS[id];
  if (!n) throw new Error(`Sin exigencias para la mazmorra: ${id}`);
  return n;
};
