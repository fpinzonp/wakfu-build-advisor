// Motor de la simulación: ejecuta una secuencia de pasos (hechizos, movimientos, fines de turno y
// ajustes) sobre un estado y devuelve, por paso, las filas de daño/cura/armadura y el estado resultante.
// Un paso no válido deja el estado sin cambios y la secuencia continúa.

import { resistancePct } from '../characteristics';
import type { Element } from '../game';
import type { TKey } from '../i18n';
import type { Spell, SpellLine } from '../spells';
import {
  SPELL_MAX_LEVEL, addArmor, addHealRes, armorValue, baseAtLevel, damageValue, distance, healValue,
  isBerserk, isMelee, positionOf, type Cell, type Facing, type Position,
} from './formulas';

export type ActorId = 'main' | 'ally';

export interface SimActor {
  id: ActorId; name: string; classId: string; level: number;
  stats: Record<string, number>; mastery: Record<Element, number>; maxHp: number;
  ap: number; mp: number; wp: number; spells: Spell[]; start: Cell;
}

export interface SimTarget {
  name: string; hp: number; res: Record<Element, number>;
  resBack: number; resCrit: number; cell: Cell; facing: Facing;
}

export type SimStep =
  | { type: 'cast'; actor: ActorId; spell: number; target: 'mob' | 'ally' | 'self' }
  | { type: 'move'; actor: ActorId; to: Cell }
  | { type: 'endTurn' }
  | { type: 'adjust'; actor?: ActorId; hpPct?: number; armor?: number; facing?: Facing };

export interface Triple { normal: number; crit: number; avg: number }

export interface StepRow {
  kind: 'damage' | 'heal' | 'armor';
  value: Triple;
  raw?: Triple;              // cura y armadura: valor antes de limitarlo a los PV que faltan o al tope
  position?: Position;       // solo daño
  tags: TKey[]; warnings: TKey[];
  uncalculated?: boolean;    // el hechizo no se pudo calcular: valor cero y no suma a los totales
}

export interface ActorState {
  cell: Cell; ap: number; mp: number; wp: number; hp: number; armor: number;
  healRes: number; states: Record<string, number>; uses: Record<number, number>;
}

export interface SimState {
  actors: Partial<Record<ActorId, ActorState>>; mobHp: number; facing: Facing; turn: number;
}

export interface StepResult { step: SimStep; ok: boolean; reason?: TKey; rows: StepRow[]; state: SimState }

export interface SimInput { actors: SimActor[]; target: SimTarget; steps: SimStep[]; comboExtraPct: number }

type Kind = StepRow['kind'];
export interface SimResult { steps: StepResult[]; totals: Partial<Record<ActorId, Record<Kind, Triple>>> }

/** Ajustes que una regla de clase aplica a un lanzamiento. `lines` aporta efectos condicionales ya resueltos. */
export interface CastMods { dmgPct?: number; tags?: TKey[]; warnings?: TKey[]; lines?: SpellLine[] }

export interface ClassRules {
  beforeCast?(state: ActorState, actor: SimActor, spell: Spell, input: SimInput): CastMods;
  afterCast?(state: ActorState, actor: SimActor, spell: Spell): void;
  onEndTurn?(state: ActorState): void;
}

/** Reglas por clase. Vacío por ahora: cada clase se añade en su propia tarea. */
export const CLASS_RULES: Partial<Record<string, ClassRules>> = {};

const MAP_SIZE = 11;
const ELEMENT_ORDER: Element[] = ['fire', 'water', 'earth', 'air'];

// El epsilon evita que el error de coma flotante reste 1 al redondear hacia abajo.
const floor = (x: number) => Math.floor(x + 1e-9);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const zero = (): Triple => ({ normal: 0, crit: 0, avg: 0 });
const stat = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

const triple = (normal: number, crit: number, critPct: number): Triple =>
  ({ normal, crit, avg: floor(normal * (1 - critPct / 100) + crit * (critPct / 100)) });

/** Elemento con el que se calcula: el del hechizo, o la maestría elemental más alta (luz y neutro). */
function elementOf(spell: Spell, actor: SimActor): Element {
  if ((ELEMENT_ORDER as string[]).includes(spell.el)) return spell.el as Element;
  return ELEMENT_ORDER.reduce((best, e) => ((actor.mastery[e] ?? 0) > (actor.mastery[best] ?? 0) ? e : best), ELEMENT_ORDER[0]);
}

interface Outcome { ok: boolean; reason?: TKey; rows: StepRow[] }
const fail = (reason: TKey): Outcome => ({ ok: false, reason, rows: [] });
const done = (rows: StepRow[] = []): Outcome => ({ ok: true, rows });

function otherId(id: ActorId): ActorId { return id === 'main' ? 'ally' : 'main'; }

function castStep(step: Extract<SimStep, { type: 'cast' }>, st: SimState, input: SimInput): Outcome {
  const actor = input.actors.find((a) => a.id === step.actor);
  const me = st.actors[step.actor];
  if (!actor || !me) return fail('sim.err.actor');
  const spell = actor.spells.find((s) => s.id === step.spell);
  if (!spell) return fail('sim.err.spell');

  const recipientId = step.target === 'self' ? step.actor : step.target === 'ally' ? otherId(step.actor) : undefined;
  const recipient = recipientId ? st.actors[recipientId] : undefined;
  const recipientActor = recipientId ? input.actors.find((a) => a.id === recipientId) : undefined;
  if (step.target !== 'mob' && (!recipient || !recipientActor)) return fail('sim.err.target');

  const cast = spell.cast;
  if (cast) {
    if (cast.perTurn !== null && (me.uses[spell.id] ?? 0) >= cast.perTurn) return fail('sim.err.uses');
    if (me.ap < cast.ap) return fail('sim.err.ap');
    if (me.mp < cast.mp) return fail('sim.err.mp');
    if (me.wp < cast.wp) return fail('sim.err.wp');
    if (step.target !== 'self') {
      const to = step.target === 'mob' ? input.target.cell : recipient!.cell;
      const d = distance(me.cell, to);
      const max = Math.max(cast.rangeMin, cast.rangeMax + (cast.rangeMod ? stat(actor.stats, 'range') : 0));
      if (d < cast.rangeMin || d > max) return fail('sim.err.range');
    }
  }

  const rules = CLASS_RULES[actor.classId];
  const mods: CastMods = rules?.beforeCast?.(me, actor, spell, input) ?? {};

  if (!cast) {
    me.uses[spell.id] = (me.uses[spell.id] ?? 0) + 1;
    rules?.afterCast?.(me, actor, spell);
    return done([uncalculatedRow(['sim.warn.noData', ...(mods.warnings ?? [])])]);
  }

  me.ap -= cast.ap; me.mp -= cast.mp; me.wp -= cast.wp;
  me.uses[spell.id] = (me.uses[spell.id] ?? 0) + 1;

  // Avisos comunes a todas las filas del hechizo.
  const warn: TKey[] = [];
  const hasInjected = (mods.lines?.length ?? 0) > 0;
  if (cast.reasons.includes('conditional') && !hasInjected) warn.push('sim.warn.conditional');
  if (cast.reasons.includes('secondary')) warn.push('sim.warn.secondary');
  if (cast.reasons.includes('noCrit')) warn.push('sim.warn.noCrit');
  warn.push(...(mods.warnings ?? []));

  // Berserker: sus efectos sustituyen a los normales cuando hay.
  const berserk = isBerserk((me.hp / actor.maxHp) * 100);
  const base = berserk && cast.berserkLines?.length ? cast.berserkLines : cast.lines;
  const applies = (l: SpellLine) =>
    l.side === 'caster' ? l.kind !== 'damage' : l.side === 'enemy' ? step.target === 'mob' : step.target !== 'mob';
  const lines = [...base, ...(mods.lines ?? [])].filter(applies);

  let rows: StepRow[];
  if (lines.length === 0) {
    // Sin líneas utilizables: si hay efectos solo condicionales, no se calculan pero se avisan.
    const hasConditional = cast.conditional.some((c) => c.lines.length > 0);
    rows = hasConditional ? [uncalculatedRow(unique(warn))] : [];
  } else {
    const level = clamp(floor(actor.level) || 1, 1, SPELL_MAX_LEVEL);
    const critPct = clamp(stat(actor.stats, 'crit'), 0, 100);
    const el = elementOf(spell, actor);
    rows = [];
    for (const l of lines) {
      const toCaster = l.side === 'caster';
      const rId = toCaster ? step.actor : recipientId;
      const rState = rId ? st.actors[rId] : undefined;
      const rActor = rId ? input.actors.find((a) => a.id === rId) : undefined;
      const noCrit = cast.reasons.includes('noCrit');
      const nBase = baseAtLevel(l.min, l.max, level);
      const cBase = noCrit ? nBase : baseAtLevel(l.critMin, l.critMax, level);
      const rowWarn: TKey[] = unique(spell.el === 'neutral' && l.kind !== 'armor' ? [...warn, 'sim.warn.element'] : warn);
      const row = l.kind === 'damage'
        ? damageRow({ nBase, cBase, critPct, el, actor, me, st, input, berserk, mods, warn: rowWarn })
        : supportRow({ l, nBase, cBase, critPct, el, actor, me, rState, rActor, onSelf: rId === step.actor, berserk, mods, warn: rowWarn });
      rows.push(row);
    }
  }
  rules?.afterCast?.(me, actor, spell);
  return done(rows);
}

const unique = <T,>(xs: T[]): T[] => [...new Set(xs)];

const uncalculatedRow = (warnings: TKey[]): StepRow =>
  ({ kind: 'damage', value: zero(), tags: [], warnings, uncalculated: true });

interface RowCtx {
  nBase: number; cBase: number; critPct: number; el: Element; actor: SimActor; me: ActorState;
  berserk: boolean; mods: CastMods; warn: TKey[];
}

function damageRow(c: RowCtx & { st: SimState; input: SimInput }): StepRow {
  const { actor, input, st, me, mods } = c;
  const mob = input.target;
  const melee = isMelee(me.cell, mob.cell);
  const position = positionOf(me.cell, mob.cell, st.facing);
  const common = (melee ? stat(actor.stats, 'mastMelee') : stat(actor.stats, 'mastDist'))
    + (c.berserk ? stat(actor.stats, 'mastBerserk') : 0)
    + (position === 'back' ? stat(actor.stats, 'mastBack') : 0)
    + (actor.mastery[c.el] ?? 0);
  const dmgPct = Math.max(-100, stat(actor.stats, 'dmgPct') + (mods.dmgPct ?? 0) + input.comboExtraPct);
  const res = (mob.res[c.el] ?? 0) + (position === 'back' ? mob.resBack : 0);
  const hit = (base: number, mastery: number, extraRes: number) => Math.max(0, damageValue({
    base, mastery: Math.max(-100, mastery), position, dmgPct, resPct: Math.min(100, resistancePct(res + extraRes)),
  }));
  const value = triple(
    hit(c.nBase, common, 0),
    hit(c.cBase, common + stat(actor.stats, 'mastCrit'), mob.resCrit),
    c.critPct,
  );
  st.mobHp = Math.max(0, st.mobHp - value.avg);
  const tags: TKey[] = [melee ? 'sim.tag.melee' : 'sim.tag.dist'];
  if (position === 'side') tags.push('sim.tag.side');
  if (position === 'back') tags.push('sim.tag.back');
  if (c.berserk) tags.push('sim.tag.berserk');
  if (input.comboExtraPct) tags.push('sim.tag.combo');
  tags.push(...(mods.tags ?? []));
  return { kind: 'damage', value, position, tags: unique(tags), warnings: c.warn };
}

function supportRow(c: RowCtx & {
  l: SpellLine; rState?: ActorState; rActor?: SimActor; onSelf: boolean;
}): StepRow {
  const { actor, me, mods, l, rState, rActor } = c;
  const tags: TKey[] = [];
  // Receptor ausente solo ocurre con datos incoherentes: se avisa en lugar de omitirse.
  if (!rState || !rActor) return { ...uncalculatedRow(c.warn), kind: l.kind };

  let raw: Triple;
  let value: Triple;
  if (l.kind === 'heal') {
    const melee = isMelee(me.cell, rState.cell);
    tags.push(melee ? 'sim.tag.melee' : 'sim.tag.dist');
    if (c.berserk) tags.push('sim.tag.berserk');
    const mastery = (melee ? stat(actor.stats, 'mastMelee') : stat(actor.stats, 'mastDist'))
      + (c.berserk ? stat(actor.stats, 'mastBerserk') : 0)
      + stat(actor.stats, 'mastHeal') + (actor.mastery[c.el] ?? 0);
    const heal = (base: number, extra: number) => Math.max(0, healValue({
      base, mastery: Math.max(-100, mastery + extra), healDone: stat(actor.stats, 'healPct'),
      healReceived: stat(rActor.stats, 'healReceived'), healRes: clamp(rState.healRes, 0, 100),
      incurable: clamp(rState.states.incurable ?? 0, 0, 100),
    }));
    raw = triple(heal(c.nBase, 0), heal(c.cBase, stat(actor.stats, 'mastCrit')), c.critPct);
    const room = Math.max(0, rActor.maxHp - rState.hp);
    value = triple(Math.min(raw.normal, room), Math.min(raw.crit, room), c.critPct);
    rState.hp += value.avg;
    rState.healRes = addHealRes(rState.healRes, value.avg, rActor.maxHp);
  } else {
    const arm = (base: number) => Math.max(0, armorValue({
      base, armorGiven: stat(actor.stats, 'armorGiven'), armorReceived: stat(rActor.stats, 'armorReceived'),
      crumbly: clamp(rState.states.crumbly ?? 0, 0, 100), onSelf: c.onSelf,
    }));
    raw = triple(arm(c.nBase), arm(c.cBase), c.critPct);
    const room = Math.max(0, addArmor(0, Infinity, rActor.maxHp) - rState.armor);
    value = triple(Math.min(raw.normal, room), Math.min(raw.crit, room), c.critPct);
    rState.armor = addArmor(rState.armor, value.avg, rActor.maxHp);
  }
  tags.push(...(mods.tags ?? []));
  return { kind: l.kind, value, raw, tags: unique(tags), warnings: c.warn };
}

function moveStep(step: Extract<SimStep, { type: 'move' }>, st: SimState, input: SimInput): Outcome {
  const me = st.actors[step.actor];
  if (!me) return fail('sim.err.actor');
  const { x, y } = step.to;
  const inside = Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
  const occupied = [input.target.cell, ...Object.entries(st.actors).filter(([id]) => id !== step.actor).map(([, a]) => a!.cell)]
    .some((c) => c.x === x && c.y === y);
  if (!inside || occupied) return fail('sim.err.cell');
  const cost = distance(me.cell, step.to);
  if (cost > me.mp) return fail('sim.err.mp');
  me.mp -= cost;
  me.cell = { x, y };
  return done();
}

function adjustStep(step: Extract<SimStep, { type: 'adjust' }>, st: SimState, input: SimInput): Outcome {
  const id = step.actor ?? 'main';
  const me = st.actors[id];
  const actor = input.actors.find((a) => a.id === id);
  if (!me || !actor) return fail('sim.err.actor');
  if (step.hpPct !== undefined) me.hp = floor(clamp(step.hpPct, 0, 100) / 100 * actor.maxHp);
  if (step.armor !== undefined) me.armor = clamp(floor(step.armor), 0, addArmor(0, Infinity, actor.maxHp));
  if (step.facing) st.facing = step.facing;
  return done();
}

function endTurn(st: SimState, input: SimInput): Outcome {
  for (const actor of input.actors) {
    const s = st.actors[actor.id];
    if (!s) continue;
    s.ap = actor.ap; s.mp = actor.mp; s.wp = actor.wp; s.uses = {};
    CLASS_RULES[actor.classId]?.onEndTurn?.(s);
  }
  st.turn += 1;
  return done();
}

export function simulate(input: SimInput): SimResult {
  const actors: SimState['actors'] = {};
  const totals: NonNullable<SimResult['totals']> = {};
  for (const a of input.actors) {
    actors[a.id] = {
      cell: { ...a.start }, ap: a.ap, mp: a.mp, wp: a.wp, hp: a.maxHp, armor: 0, healRes: 0, states: {}, uses: {},
    };
    totals[a.id] = { damage: zero(), heal: zero(), armor: zero() };
  }
  let state: SimState = { actors, mobHp: input.target.hp, facing: input.target.facing, turn: 1 };

  const steps: StepResult[] = input.steps.map((step) => {
    const next = structuredClone(state);
    const out =
      step.type === 'cast' ? castStep(step, next, input)
        : step.type === 'move' ? moveStep(step, next, input)
          : step.type === 'adjust' ? adjustStep(step, next, input)
            : endTurn(next, input);
    // Un paso rechazado no cambia nada: se conserva el estado anterior.
    if (out.ok) state = next;
    if (out.ok && step.type === 'cast') {
      const sum = totals[step.actor];
      for (const row of out.rows) {
        if (row.uncalculated || !sum) continue;
        for (const k of ['normal', 'crit', 'avg'] as const) sum[row.kind][k] += row.value[k];
      }
    }
    return { step, ok: out.ok, ...(out.reason ? { reason: out.reason } : {}), rows: out.rows, state: structuredClone(state) };
  });

  return { steps, totals };
}
