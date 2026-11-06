// El aliado del modo de apoyo: un personaje del simulador sacado de una build guardada.

import type { Item } from '../game';
import { resolveSaved } from '../savedBuild';
import { decodeBuild, type StoredBuild } from '../share';
import type { SpellData } from '../spells';
import type { SimActor } from './engine';
import type { Cell } from './formulas';
import { actorFromBuild } from './fromBuild';

export const ALLY_START: Cell = { x: 3, y: 3 };

/** Null si el código está roto, la clase ya no existe o no queda ningún objeto de la build. */
export function allyFromStored(stored: StoredBuild, items: Item[], spellData: SpellData, start: Cell = ALLY_START): SimActor | null {
  const saved = decodeBuild(stored.code);
  if (!saved) return null;
  const resolved = resolveSaved(saved, items, spellData);
  if (!resolved || Object.keys(resolved.slots).length === 0) return null;
  const s = saved.settings;
  return actorFromBuild('ally', resolved.result, {
    classId: s.classId, level: s.level, elements: s.elements, deck: saved.deck, spells: resolved.spells, start, name: stored.name,
  });
}
