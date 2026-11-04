// Baraja de hechizos: 12 activos y hasta 6 pasivas. Las pasivas con efectos permanentes
// (data/spell-stats.json) se suman a las características y al optimizador.

export type SpellElement = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'neutral' | 'passive';

export interface Spell {
  id: number;
  name: string;         // nombre en inglés (wakfu.wiki.gg)
  el: SpellElement;
  lvl: number;          // nivel necesario (0 = desde el inicio)
  icon: number;
  text: string[];       // efecto según la wiki (inglés)
  stats?: Record<string, number | string>;  // número o "N%lvl"
  zero?: string[];      // características que la pasiva deja a 0
}

export interface SpellData { version: string; common: Spell[]; classes: Record<string, Spell[]> }

export interface Deck { actives: number[]; passives: number[] }
export const EMPTY_DECK: Deck = { actives: [], passives: [] };

export const ACTIVE_SLOTS = 12;
/** Ranuras de pasivas desbloqueadas por nivel (10, 30, 50, 100, 150 y 200). */
export const passiveSlots = (level: number) => [10, 30, 50, 100, 150, 200].filter((l) => level >= l).length;

export const SPELL_GROUPS: { el: SpellElement; label: string; color: string }[] = [
  { el: 'fire', label: 'Fuego', color: '#e8643a' },
  { el: 'water', label: 'Agua', color: '#3a9be8' },
  { el: 'earth', label: 'Tierra', color: '#8fb33a' },
  { el: 'air', label: 'Aire', color: '#b48be8' },
  { el: 'light', label: 'Luz', color: '#f0d264' },
  { el: 'neutral', label: 'Neutros', color: '#c9b27c' },
];

export const spellImage = (icon: number) => `https://static.ankama.com/wakfu/portal/game/spell/${icon}.png`;

/** Hechizos de la clase más los comunes (pasivas comunes y hechizos de arma). */
export const classSpells = (data: SpellData, classId: string) => [...(data.classes[classId] ?? []), ...data.common];

export interface DeckBonus { stats: Record<string, number>; zero: string[] }
export const NO_DECK_BONUS: DeckBonus = { stats: {}, zero: [] };

const statValue = (v: number | string, level: number) => {
  if (typeof v === 'number') return v;
  const m = /^(-?\d+(?:\.\d+)?)%lvl$/.exec(v);
  return m ? Math.floor((Number(m[1]) / 100) * level) : 0;
};

/** Efecto permanente de una pasiva a un nivel dado. */
export function spellStats(spell: Spell, level: number): Record<string, number> {
  return Object.fromEntries(Object.entries(spell.stats ?? {}).map(([k, v]) => [k, statValue(v, level)]));
}

/** Suma de los efectos permanentes de las pasivas equipadas. */
export function deckBonus(passives: Spell[], level: number): DeckBonus {
  const stats: Record<string, number> = {};
  const zero = new Set<string>();
  for (const p of passives) {
    for (const [k, v] of Object.entries(spellStats(p, level))) stats[k] = (stats[k] ?? 0) + v;
    p.zero?.forEach((k) => zero.add(k));
  }
  return { stats, zero: [...zero] };
}

/** Quita de la baraja lo que no existe en la clase, supera el nivel o no cabe. */
export function fitDeck(deck: Deck, spells: Spell[], level: number): Deck {
  const byId = new Map(spells.map((s) => [s.id, s]));
  const ok = (id: number, passive: boolean) => {
    const s = byId.get(id);
    return !!s && s.lvl <= level && (s.el === 'passive') === passive;
  };
  return {
    actives: deck.actives.filter((id) => ok(id, false)).slice(0, ACTIVE_SLOTS),
    passives: deck.passives.filter((id) => ok(id, true)).slice(0, passiveSlots(level)),
  };
}
