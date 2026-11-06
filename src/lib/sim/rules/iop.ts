// Reglas del Yopuka: combos por orden de costes, Concentración y Preparación.
// Los combos se detectan por los costes de los hechizos lanzados en el turno (andar no cuenta) y
// su efecto cae sobre el último hechizo del combo. Cada hechizo suma su Concentración; al llegar
// a 100 da 1 PW y 4 de Preparación. La Preparación (+1 % de daño por nivel) se gasta en el
// siguiente hechizo de daño.

import type { Spell } from '../../spells';
import type { ActorState, CastMods, CastTarget, ClassRules, SimActor, SimInput } from '../engine';
import type { TKey } from '../../i18n';

export type Cost = 'ap1' | 'ap2' | 'ap3' | 'mp1' | 'wp1';
export type ComboId = 'healSteal' | 'push' | 'prep' | 'extra' | 'ap';

/** Secuencias de costes del módulo de estados de la wiki. */
export const COMBOS: Record<ComboId, Cost[]> = {
  healSteal: ['mp1', 'ap3', 'ap3'],
  push: ['ap1', 'ap1', 'ap2'],
  prep: ['mp1', 'mp1', 'wp1'],
  extra: ['ap2', 'ap1', 'mp1'],
  ap: ['wp1', 'ap3', 'wp1', 'ap1'],
};

const CONCENTRATION = 3442;
export const PREPARATION = '3462';
export const CONC_KEY = String(CONCENTRATION);
const CONC_MAX = 400;
const CONC_EVENT = 100;
const PREP_MAX = 60;
const PREP_PER_EVENT = 4;
const PREP_PER_COMBO = 20;
const COMBO_CONC = 5;
const COMBO_AP = 2;
const LIFE_STEAL_PCT = 150;
const JUDGMENT_PREP = 10;  // Preparación que da Juicio a un aliado

/** Combo que completa el final del historial, o null. */
export function matchCombo(history: readonly Cost[]): ComboId | null {
  for (const [id, seq] of Object.entries(COMBOS) as [ComboId, Cost[]][]) {
    if (history.length >= seq.length && seq.every((c, i) => history[history.length - seq.length + i] === c)) return id;
  }
  return null;
}

/** Paso de combo de un hechizo: solo si cuesta exactamente eso y nada más. */
function costOf(spell: Spell): Cost | null {
  const c = spell.cast;
  if (!c) return null;
  const kinds = [c.ap > 0, c.mp > 0, c.wp > 0].filter(Boolean).length;
  if (kinds !== 1) return null;
  if (c.ap === 1 || c.ap === 2 || c.ap === 3) return `ap${c.ap}`;
  if (c.mp === 1) return 'mp1';
  if (c.wp === 1) return 'wp1';
  return null;
}

/** Historial del turno con este hechizo añadido (sin modificar el estado). */
function historyWith(state: ActorState, spell: Spell): Cost[] {
  const past = (state.history ?? []) as Cost[];
  const cost = costOf(spell);
  return cost ? [...past, cost] : [];  // un hechizo que no es paso rompe la secuencia
}

/** Hechizo que daña al enemigo: es el que gasta la Preparación. */
const dealsDamage = (spell: Spell) =>
  [...(spell.cast?.lines ?? []), ...(spell.cast?.berserkLines ?? [])].some((l) => l.kind === 'damage' && l.side === 'enemy');

const hasDissipation = (actor: SimActor) => actor.passives?.includes('Dissipation') ?? false;

/** Juicio: "Cast on an enemy" es su daño y "Cast on an ally" da Preparación; ninguna de las ramas es una condición real. */
const isJudgment = (spell: Spell) => spell.cast?.key === 'Judgment';
const judgmentHit = (spell: Spell) => spell.cast?.conditional.find((c) => /on an enemy/i.test(c.when))?.lines ?? [];

/** Si este lanzamiento daña al mob: es lo que gasta la Preparación. */
const hitsMob = (spell: Spell, target: CastTarget) => target === 'mob' && (dealsDamage(spell) || isJudgment(spell));

function beforeCast(state: ActorState, _actor: SimActor, spell: Spell, input: SimInput, target: CastTarget): CastMods {
  if (!spell.cast) return {};
  const combo = matchCombo(historyWith(state, spell));
  const dealsDmg = hitsMob(spell, target);
  const mods: CastMods = {};
  const tags: TKey[] = [];
  const warnings: TKey[] = [];
  let dmgPct = 0;

  const prep = state.states[PREPARATION] ?? 0;
  if (dealsDmg && prep > 0) { dmgPct += prep; tags.push('sim.tag.preparation'); }

  if (isJudgment(spell)) {
    mods.instead = target === 'mob' ? judgmentHit(spell) : [];
    // Sobre el mob, el estado que le deja no se calcula; sobre un aliado no hay valor que enseñar.
    warnings.push(target === 'mob' ? 'sim.warn.secondary' : 'sim.warn.prepGiven');
  }

  if (combo === 'healSteal') mods.lifeStealPct = LIFE_STEAL_PCT;
  if (combo === 'push') { tags.push('sim.tag.push'); warnings.push('sim.warn.collision'); }
  if (combo === 'prep') tags.push('sim.tag.comboPrep');
  if (combo === 'ap') tags.push('sim.tag.comboAp');
  if (combo === 'extra' && dealsDmg) {
    dmgPct += input.comboExtraPct;
    tags.push('sim.tag.combo', 'sim.tag.unconfirmed');
  }

  if (dmgPct) mods.dmgPct = dmgPct;
  if (tags.length) mods.tags = tags;
  if (warnings.length) mods.warnings = warnings;
  return mods;
}

function afterCast(state: ActorState, actor: SimActor, spell: Spell, target: CastTarget, recipient?: ActorState): void {
  const cast = spell.cast;
  if (!cast) { state.history = []; return; }
  const history = historyWith(state, spell);
  const combo = matchCombo(history);
  state.history = combo === null ? history : [];  // un combo completado consume sus pasos

  // La Preparación acumulada se gasta aquí; la que den este hechizo o su combo queda para el siguiente.
  if (hitsMob(spell, target)) state.states[PREPARATION] = 0;
  if (isJudgment(spell) && target !== 'mob' && recipient) addPreparation(recipient, JUDGMENT_PREP);

  let conc = cast.stateGains.filter((g) => g.state === CONCENTRATION).reduce((s, g) => s + g.levels, 0);
  if (combo && !hasDissipation(actor)) conc += COMBO_CONC;
  if (conc > 0) gainConcentration(state, conc);

  if (combo === 'prep') addPreparation(state, PREP_PER_COMBO);
  if (combo === 'ap') state.ap += COMBO_AP;
}

function addPreparation(state: ActorState, levels: number): void {
  state.states[PREPARATION] = Math.min(PREP_MAX, (state.states[PREPARATION] ?? 0) + levels);
}

/** Suma Concentración (tope 400); cada 100 da 1 PW y 4 de Preparación y se resta. */
function gainConcentration(state: ActorState, levels: number): void {
  let conc = Math.min(CONC_MAX, (state.states[CONC_KEY] ?? 0) + levels);
  while (conc >= CONC_EVENT) {
    conc -= CONC_EVENT;
    state.wp += 1;
    addPreparation(state, PREP_PER_EVENT);
  }
  state.states[CONC_KEY] = conc;
}

export const iopRules: ClassRules = {
  beforeCast,
  afterCast,
  onEndTurn(state) { state.history = []; },
};
