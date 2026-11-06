// Convierte una build guardada o compartida en su resultado calculado, sin pasar por la interfaz.
// Lo usan `openSaved` (abrir la build) y el simulador (el aliado), para que ambos den las mismas cifras.

import { CLASSES, type BuildSlot, type Item } from './game';
import { evaluateBuild, type BuildRequest, type BuildResult, type BuildSlots } from './optimizer';
import type { BuildSettings, SavedBuild } from './share';
import { slotsFromIds } from './share';
import { NO_DECK_BONUS, classSpells, deckBonus, fitDeck, type Deck, type DeckBonus, type Spell, type SpellData } from './spells';

/** Efecto de la baraja: solo cuentan las pasivas de la clase que caben a este nivel. */
export function bonusFor(data: SpellData | null, classId: string, deck: Deck, level: number): DeckBonus {
  if (!data) return NO_DECK_BONUS;
  const spells = classSpells(data, classId);
  const byId = new Map(spells.map((s) => [s.id, s]));
  return deckBonus(fitDeck(deck, spells, level).passives.map((id) => byId.get(id)!), level);
}

/** Petición de evaluación para unos ajustes. Las piezas fijadas por encima del nivel dejan de aplicarse. */
export function requestFor(s: BuildSettings, lock: BuildSlots, deckEffect: DeckBonus): BuildRequest {
  const c = CLASSES.find((x) => x.id === s.classId)!;
  const usable: BuildSlots = {};
  for (const [slot, item] of Object.entries(lock)) if (item && item.lvl <= s.level) usable[slot as BuildSlot] = item;
  return {
    level: s.level, classId: s.classId, role: s.role, elements: s.elements, targets: s.targets, allowedRarities: s.rarities,
    minLevel: s.minLevel, craftOnly: s.craftOnly, berserk: s.berserk && !!c.berserk, crit: s.crit, back: s.back,
    excluded: new Set(s.excluded), locked: usable, deck: deckEffect,
  };
}

export interface ResolvedBuild { result: BuildResult; slots: BuildSlots; lock: BuildSlots; spells: Spell[] }

/**
 * Evalúa una build guardada tal cual (sin volver a optimizar). Devuelve null si su clase ya no existe.
 * No incluye runas ni sublimaciones: esas las suma la vista de la build con los datos de encantamiento.
 */
export function resolveSaved(saved: SavedBuild, items: Item[], spellData: SpellData | null): ResolvedBuild | null {
  const s = saved.settings;
  if (!CLASSES.some((c) => c.id === s.classId)) return null;
  const slots = slotsFromIds(saved.slots, items);
  const lock: BuildSlots = {};
  for (const slot of saved.locked) if (slots[slot]) lock[slot] = slots[slot];
  const result = evaluateBuild(slots, requestFor(s, lock, bonusFor(spellData, s.classId, saved.deck, s.level)));
  return { result, slots, lock, spells: spellData ? classSpells(spellData, s.classId) : [] };
}
