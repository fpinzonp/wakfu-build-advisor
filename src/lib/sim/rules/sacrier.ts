// Reglas del Sacrogrito: berserker (por debajo del 50 % de PV), retorno de llama (daño propio en %),
// Punición, ramas por armadura (Pie Rocoso y Aplastar), Aversión y la pasiva Corazón de Sacrogrito.
// El motor ya suma la maestría berserker y cambia a `berserkLines`; aquí solo va lo propio de la clase.

import type { Spell, SpellLine } from '../../spells';
import type { ActorState, CastMods, CastTarget, ClassRules, ExtraCost, SimActor, SimInput } from '../engine';
import { isBerserk } from '../formulas';

/** Daño propio de un hechizo: % de los PV máximos o actuales, antes o después de golpear. */
export interface SelfCost { pctOf: 'max' | 'current'; pct: number; when: 'before' | 'after' }

/**
 * Hechizos activos con "Retorno de llama" propio, por `cast.key`; valores de la wiki.
 * Si el daño ocurre antes que el golpe ('before'), ese golpe ya cuenta con los PV rebajados.
 * No entra Spiritual Tempest: su 10 % cuelga de "por cada hechizo de movimiento del turno", que no se modela.
 */
export const SELF_COST: Record<string, SelfCost> = {
  'Burning Blood': { pctOf: 'max', pct: 10, when: 'before' },
  'Lethal Punishment': { pctOf: 'max', pct: 20, when: 'before' },
  "Sacrier's Fist": { pctOf: 'max', pct: 5, when: 'after' },
  // Lanzado sobre el propio Sacrogrito o sobre un aliado, el lanzador paga lo mismo.
  Gash: { pctOf: 'current', pct: 51, when: 'before' },
};

/**
 * Hechizos que la wiki no fichó para el Sacrogrito (su página es de otra clase) y llegan sin `cast`:
 * se reconocen por su id estable de public/data/spells.json. El coste sale de la fila de la wiki (WP 1).
 */
const KEY_BY_ID: Record<number, string> = { 3084921951: 'Gash' };
const NO_CARD_COST: Record<string, ExtraCost> = { Gash: { wp: 1 } };

const keyOf = (spell: Spell): string | undefined => spell.cast?.key ?? KEY_BY_ID[spell.id];

/** Hechizos que fijan los PV en un % de los máximos antes del golpe. */
const HP_SET: Record<string, number> = { Punition: 20 };

/** Coste extra en berserker, de "Costs 1 extra WP/AP". */
const BERSERK_EXTRA: Record<string, ExtraCost> = {
  'Light Speed': { wp: 1 },
  Assault: { wp: 1 },
  Attraction: { wp: 1 },
  'Motion Sickness': { ap: 1 },
};

const SMASHES_ARMOR_PCT = 25;  // % de PV máximos en armadura que activa y consume la rama alta
const ROCKY_ARMOR_PCT = 5;     // % de PV máximos en armadura que gasta Pie Rocoso con armadura
const SACRIERS_HEART = "Sacrier's Heart";

const hpPct = (state: ActorState, actor: SimActor) => (state.hp / actor.maxHp) * 100;
const pctOfMax = (actor: SimActor, pct: number) => Math.floor((actor.maxHp * pct) / 100 + 1e-9);
const setHp = (state: ActorState, hp: number) => { state.hp = Math.max(1, hp); };

function applySelfCost(state: ActorState, actor: SimActor, key: string, when: SelfCost['when']): void {
  const c = SELF_COST[key];
  if (!c || c.when !== when) return;
  const amount = Math.floor(((c.pctOf === 'max' ? actor.maxHp : state.hp) * c.pct) / 100 + 1e-9);
  setHp(state, state.hp - amount);
}

/** Líneas de la condición cuyo texto cumple el patrón, o undefined si la ficha no la trae. */
function branch(spell: Spell, re: RegExp): SpellLine[] | undefined {
  return spell.cast?.conditional.find((c) => re.test(c.when))?.lines;
}

function beforeCast(
  state: ActorState, actor: SimActor, spell: Spell, _input: SimInput, _target: CastTarget, mobHpPct: number,
): CastMods {
  const cast = spell.cast;
  const key = keyOf(spell);
  if (!key) return {};
  const mods: CastMods = {};
  const casterPct = hpPct(state, actor);

  // Pie Rocoso y Aplastar dependen de la armadura; Aversión, de los PV relativos. Se decide antes de gastar PV.
  if (!cast) {
    // Hechizo sin ficha (Gash): solo se cobra el coste de PV; sus demás efectos no se calculan.
    mods.warnings = ['sim.warn.conditional'];
  } else if (key === 'Rocky Foot') {
    const withArmor = state.armor > 0;
    const lines = branch(spell, withArmor ? /has Armor/i : /no Armor/i);
    if (lines) {
      mods.instead = lines;
      if (withArmor) state.armor = Math.max(0, state.armor - pctOfMax(actor, ROCKY_ARMOR_PCT));
    }
  } else if (key === 'Smashes') {
    const need = pctOfMax(actor, SMASHES_ARMOR_PCT);
    const lines = branch(spell, /25% or more/i);
    if (lines?.length && state.armor >= need) {
      mods.instead = lines;
      state.armor -= need;
    }  // sin armadura suficiente: golpe normal; la armadura que da "Otherwise" no se calcula y el motor lo avisa
  } else if (key === 'Aversion') {
    const higher = mobHpPct > casterPct;
    const lines = higher ? branch(spell, /higher/i) : cast!.lines;
    if (lines?.length) mods.instead = lines;
  }

  // Punición: la condición de Furia no se modela, así que el cambio de PV se aplica siempre (el motor avisa).
  if (key in HP_SET) {
    const target = pctOfMax(actor, HP_SET[key]);
    if (state.hp < target) mods.warnings = [...(mods.warnings ?? []), 'sim.warn.hpRaised'];
    setHp(state, target);
  }
  applySelfCost(state, actor, key, 'before');
  return mods;
}

function afterCast(state: ActorState, actor: SimActor, spell: Spell): void {
  const key = keyOf(spell);
  if (key) applySelfCost(state, actor, key, 'after');
}

/** Coste añadido en berserker: se mira antes de cobrar nada, con los PV de ese momento. */
function extraCost(state: ActorState, actor: SimActor, spell: Spell): ExtraCost {
  const key = keyOf(spell);
  if (!key) return {};
  if (!spell.cast) return NO_CARD_COST[key] ?? {};
  return isBerserk(hpPct(state, actor)) ? BERSERK_EXTRA[key] ?? {} : {};
}

/** Corazón de Sacrogrito: en berserker, la maestría de melé y la de distancia se suman entre sí. */
function statsFor(actor: SimActor, berserk: boolean): Record<string, number> {
  if (!berserk || !actor.passives?.includes(SACRIERS_HEART)) return actor.stats;
  const both = (actor.stats.mastMelee ?? 0) + (actor.stats.mastDist ?? 0);
  return { ...actor.stats, mastMelee: both, mastDist: both };
}

export const sacrierRules: ClassRules = { extraCost, statsFor, beforeCast, afterCast };
