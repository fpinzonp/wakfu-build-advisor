// Motor de la simulación: ejecuta una secuencia de pasos (hechizos, movimientos, fines de turno y
// ajustes) sobre un estado y devuelve, por paso, las filas de daño/cura/armadura y el estado resultante.
// Un paso no válido deja el estado sin cambios y la secuencia continúa.

import { resistancePct } from '../characteristics';
import type { Element } from '../game';
import type { TKey } from '../i18n';
import type { Spell, SpellLine } from '../spells';
import {
  SPELL_MAX_LEVEL, addArmor, addHealRes, armorValue, baseAtLevel, casterZone, damageValue, distance, healValue,
  inZone, isBerserk, isCasterCentred, isMelee, positionOf, type Cell, type Facing, type Position,
} from './formulas';
import { iopRules } from './rules/iop';
import { rogueRules } from './rules/rogue';
import { sacrierRules } from './rules/sacrier';

export type ActorId = 'main' | 'ally';

export interface SimActor {
  id: ActorId; name: string; classId: string; level: number;
  stats: Record<string, number>; mastery: Record<Element, number>; maxHp: number;
  ap: number; mp: number; wp: number; spells: Spell[]; start: Cell;
  wpPerTurn?: number;   // PW que recupera al terminar el turno (depende de la clase y las pasivas); 0 por defecto
  passives?: string[];  // pasivas equipadas, por su nombre inglés de la wiki (`spells` solo trae los activos)
}

export interface SimTarget {
  name: string; hp: number; res: Record<Element, number>;
  resBack: number; resCrit: number; cell: Cell; facing: Facing;
}

export type SimStep =
  | { type: 'cast'; actor: ActorId; spell: number; target: 'mob' | 'ally' | 'self' }
  | { type: 'move'; actor: ActorId; to: Cell }
  | { type: 'endTurn' }
  | { type: 'adjust'; actor?: ActorId; hpPct?: number; armor?: number; facing?: Facing; state?: { id: string; levels: number }; wp?: number };

export interface Triple { normal: number; crit: number; avg: number }

export interface StepRow {
  kind: 'damage' | 'heal' | 'armor';
  value: Triple;
  raw?: Triple;              // cura y armadura: valor antes de limitarlo a los PV que faltan o al tope
  position?: Position;       // solo daño
  tags: TKey[]; warnings: TKey[];
  tagVars?: Record<string, number>;  // valores que usan los textos de las etiquetas (p. ej. el % de PV)
  uncalculated?: boolean;    // el hechizo no se pudo calcular: valor cero y no suma a los totales
}

export interface ActorState {
  cell: Cell; ap: number; mp: number; wp: number; hp: number; armor: number;
  healRes: number; states: Record<string, number>; uses: Record<number, number>;
  history?: string[];  // costes de los hechizos del turno, para los combos de clase; se vacía al terminar el turno
  pending?: Record<string, PendingHit>;  // golpes diferidos por la clave del hechizo que los guardó
}

/** Golpe que una regla de clase deja guardado hasta que ocurra su disparador. */
export interface PendingHit { line: SpellLine; spellId: number }

/** Golpe adicional que la regla de clase pide emitir en el paso actual. */
export interface ExtraHit { line: SpellLine; spellId: number; tags: TKey[] }
export interface AfterCastResult { extraHits?: ExtraHit[] }

export interface SimState {
  actors: Partial<Record<ActorId, ActorState>>; mobHp: number; facing: Facing; turn: number;
}

export interface StepResult { step: SimStep; ok: boolean; reason?: TKey; rows: StepRow[]; state: SimState }

export interface SimInput { actors: SimActor[]; target: SimTarget; steps: SimStep[]; comboExtraPct: number }

type Kind = StepRow['kind'];
export interface SimResult { steps: StepResult[]; totals: Partial<Record<ActorId, Record<Kind, Triple>>> }

/** A quién va el hechizo: al mob, al aliado o al propio lanzador. */
export type CastTarget = 'mob' | 'ally' | 'self';

/** Ajustes que una regla de clase aplica a un lanzamiento. `lines` aporta efectos condicionales ya resueltos. */
export interface CastMods {
  dmgPct?: number; tags?: TKey[]; tagVars?: Record<string, number>; warnings?: TKey[]; lines?: SpellLine[];
  instead?: SpellLine[];  // efectos "en su lugar": sustituyen a los normales y a los de berserker; [] = sin filas de valor
  lifeStealPct?: number;  // el lanzador se cura este % del daño infligido (fila de cura aparte)
  // La regla ya resuelve las ramas condicionales cuya condición reconoce: de ellas no se avisa. Las demás siguen avisando.
  resolvedConditional?: (when: string) => boolean;
}

/** Recursos extra que cuesta un hechizo según el estado del lanzador (p. ej. en berserker). */
export interface ExtraCost { ap?: number; mp?: number; wp?: number }

export interface ClassRules {
  /** Coste añadido al del hechizo; se valida antes de gastar nada y se cobra con el resto. */
  extraCost?(state: ActorState, actor: SimActor, spell: Spell): ExtraCost;
  /** Características con las que el lanzador calcula el hechizo (p. ej. maestrías que se suman en berserker). */
  statsFor?(actor: SimActor, berserk: boolean): Record<string, number>;
  /** `mobHpPct` es el % de PV que le queda al objetivo respecto a los que tenía al empezar. */
  beforeCast?(state: ActorState, actor: SimActor, spell: Spell, input: SimInput, target: CastTarget, mobHpPct: number): CastMods;
  /** `recipient` es quien recibe el hechizo cuando no va al mob: el aliado o el propio lanzador. */
  afterCast?(state: ActorState, actor: SimActor, spell: Spell, target: CastTarget, recipient?: ActorState): AfterCastResult | void;
  onEndTurn?(state: ActorState): void;
}

/** Reglas por clase: cada clase se añade en su propia tarea. */
export const CLASS_RULES: Partial<Record<string, ClassRules>> = { yopuka: iopRules, sacrogrito: sacrierRules, tymador: rogueRules };

/** Qué hace una rama condicional en este lanzamiento: se aplica, no corresponde, o el motor no sabe decidirlo. */
// `skipTarget`: la rama es de otro destino; `skipRange`: el alcance (melé o distancia) la descarta.
type Branch = 'apply' | 'skipTarget' | 'skipRange' | 'unknown';

// "Cast on an enemy", "Cast on ally"...: la rama depende solo de a quién va el hechizo. Lista cerrada: "Cast on KO'd ally"
// o "Cast on the turret" dependen de algo más y no se deciden.
const CAST_ON = /^cast on(?: an?| the)?(?: target)? (?:(enem(?:y|ies))|(all(?:y|ies)))$/i;

/** `melee` es si el lanzador está a 1-2 casillas del mob; solo cuenta cuando el hechizo va al mob. */
function branchOf(when: string, target: CastTarget, melee: boolean): Branch {
  const w = when.trim();
  const range = /^(melee|distance)$/i.exec(w)?.[1].toLowerCase();
  if (range) return target !== 'mob' ? 'skipTarget' : melee === (range === 'melee') ? 'apply' : 'skipRange';
  const castOn = CAST_ON.exec(w);
  // "Cast on ally" es solo para el otro personaje: sobre uno mismo no se aplica.
  if (castOn) return (castOn[1] ? target === 'mob' : target === 'ally') ? 'apply' : 'skipTarget';
  return 'unknown';
}

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
  const rules = CLASS_RULES[actor.classId];
  // Coste extra de la clase; también cubre hechizos sin ficha (`cast`), cuyo coste la regla conoce por otra vía.
  const extra: ExtraCost = rules?.extraCost?.(me, actor, spell) ?? {};
  if (!cast) {
    if (me.ap < (extra.ap ?? 0)) return fail('sim.err.ap');
    if (me.mp < (extra.mp ?? 0)) return fail('sim.err.mp');
    if (me.wp < (extra.wp ?? 0)) return fail('sim.err.wp');
  } else {
    if (cast.perTurn !== null && (me.uses[spell.id] ?? 0) >= cast.perTurn) return fail('sim.err.uses');
    if (me.ap < cast.ap + (extra.ap ?? 0)) return fail('sim.err.ap');
    if (me.mp < cast.mp + (extra.mp ?? 0)) return fail('sim.err.mp');
    if (me.wp < cast.wp + (extra.wp ?? 0)) return fail('sim.err.wp');
    if (step.target !== 'self') {
      const to = step.target === 'mob' ? input.target.cell : recipient!.cell;
      if (isCasterCentred(cast)) {
        // Se lanza sobre la propia casilla: lo que cuenta es que el objetivo quede dentro de la zona.
        if (!inZone(casterZone(cast), me.cell, to)) return fail('sim.err.zone');
      } else {
        const d = distance(me.cell, to);
        const max = Math.max(cast.rangeMin, cast.rangeMax + (cast.rangeMod ? stat(actor.stats, 'range') : 0));
        if (d < cast.rangeMin || d > max) return fail('sim.err.range');
      }
    }
  }

  const mobHpPct = input.target.hp > 0 ? (st.mobHp / input.target.hp) * 100 : 0;
  const mods: CastMods = rules?.beforeCast?.(me, actor, spell, input, step.target, mobHpPct) ?? {};

  if (!cast) {
    me.ap -= extra.ap ?? 0; me.mp -= extra.mp ?? 0; me.wp -= extra.wp ?? 0;
    me.uses[spell.id] = (me.uses[spell.id] ?? 0) + 1;
    const after = rules?.afterCast?.(me, actor, spell, step.target, recipient);
    return done([uncalculatedRow(['sim.warn.noData', ...(mods.warnings ?? [])], mods), ...extraRows(after, actor, me, st, input)]);
  }

  me.ap -= cast.ap + (extra.ap ?? 0); me.mp -= cast.mp + (extra.mp ?? 0); me.wp -= cast.wp + (extra.wp ?? 0);
  me.uses[spell.id] = (me.uses[spell.id] ?? 0) + 1;

  // Avisos comunes a todas las filas del hechizo.
  const warn: TKey[] = [];
  const hasInjected = (mods.lines?.length ?? 0) > 0 || mods.instead !== undefined;
  // Las ramas que decide el paso (a quién va, melé o distancia) se aplican o se descartan sin avisar; solo avisan las que
  // quedan sin decidir. Sin ramas, el motivo viene de un efecto que no se pudo leer y se avisa siempre.
  const melee = isMelee(me.cell, input.target.cell);
  const branches = cast.conditional.map((b) => ({ b, r: branchOf(b.when, step.target, melee) }));
  const applied = branches.filter((x) => x.r === 'apply').map((x) => x.b);
  const undecided = branches.filter((x) => x.r === 'unknown' && !mods.resolvedConditional?.(x.b.when));
  if (cast.reasons.includes('conditional') && !hasInjected && (branches.length === 0 || undecided.length > 0)) warn.push('sim.warn.conditional');
  if (applied.some((b) => b.unread)) warn.push('sim.warn.secondary');
  // Una rama descartada con efectos nunca desaparece en silencio: por destino avisa `targetDropped`, por alcance `conditional`.
  const skipped = (r: Branch) => branches.some((x) => x.r === r && x.b.lines.length > 0);
  if (skipped('skipTarget')) warn.push('sim.warn.targetDropped');
  if (skipped('skipRange')) warn.push('sim.warn.conditional');
  if (cast.reasons.includes('secondary')) warn.push('sim.warn.secondary');
  if (cast.reasons.includes('noCrit')) warn.push('sim.warn.noCrit');
  if (cast.reasons.includes('critFixed')) warn.push('sim.warn.critFixed');
  warn.push(...(mods.warnings ?? []));

  // Berserker: sus efectos sustituyen a los normales cuando hay.
  const berserk = isBerserk((me.hp / actor.maxHp) * 100);
  const base = mods.instead ?? (berserk && cast.berserkLines?.length ? cast.berserkLines : cast.lines);
  // La regla de clase puede cambiar las características del lanzador (maestrías que se suman en berserker).
  const caster: SimActor = rules?.statsFor ? { ...actor, stats: rules.statsFor(actor, berserk) } : actor;
  const applies = (l: SpellLine) =>
    l.side === 'caster' ? l.kind !== 'damage' : l.side === 'enemy' ? step.target === 'mob' : step.target !== 'mob';
  const offered = [...base, ...(mods.lines ?? []), ...applied.flatMap((b) => b.lines)];
  const lines = offered.filter(applies);
  // Las líneas de daño propio nunca dan fila, pero no dependen del objetivo elegido.
  if (offered.some((l) => !applies(l) && l.side !== 'caster')) warn.push('sim.warn.targetDropped');

  let rows: StepRow[];
  if (lines.length === 0) {
    // Sin líneas utilizables: si hay algo que avisar, se dice en su fila en lugar de callarlo.
    rows = warn.length ? [uncalculatedRow(unique(warn), mods)] : [];
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
      // Sin crítico utilizable, el golpe crítico es el normal: tampoco suma maestría ni resistencia críticas.
      const noCrit = !!l.noCrit || cast.reasons.includes('noCrit');
      const nBase = baseAtLevel(l.min, l.max, level);
      const cBase = noCrit ? nBase : baseAtLevel(l.critMin, l.critMax, level);
      const rowWarn: TKey[] = unique([
        ...warn, ...(l.noCrit ? ['sim.warn.noCrit' as const] : []),
        ...(spell.el === 'neutral' && l.kind !== 'armor' ? ['sim.warn.element' as const] : []),
      ]);
      const row = l.kind === 'damage'
        ? damageRow({ nBase, cBase, noCrit, critPct, el, actor: caster, me, st, input, berserk, mods, warn: rowWarn })
        : supportRow({ l, nBase, cBase, noCrit, critPct, el, actor: caster, me, rState, rActor, onSelf: rId === step.actor, berserk, mods, warn: rowWarn });
      rows.push(row);
    }
    const steal = mods.lifeStealPct ? lifeStealRow(rows, mods.lifeStealPct, me, actor) : undefined;
    if (steal) rows.push(steal);
  }
  const after = rules?.afterCast?.(me, actor, spell, step.target, recipient);
  rows.push(...extraRows(after, actor, me, st, input));
  return done(rows);
}

/** Filas de los golpes adicionales que pide la regla de clase: daño normal con el estado ya actualizado. */
function extraRows(after: AfterCastResult | void, actor: SimActor, me: ActorState, st: SimState, input: SimInput): StepRow[] {
  const hits = (after && after.extraHits) || [];
  const rows: StepRow[] = [];
  for (const h of hits) {
    const spell = actor.spells.find((s) => s.id === h.spellId);
    if (!spell) continue;
    const berserk = isBerserk((me.hp / actor.maxHp) * 100);
    const caster: SimActor = CLASS_RULES[actor.classId]?.statsFor ? { ...actor, stats: CLASS_RULES[actor.classId]!.statsFor!(actor, berserk) } : actor;
    const l = h.line;
    const level = clamp(floor(actor.level) || 1, 1, SPELL_MAX_LEVEL);
    const nBase = baseAtLevel(l.min, l.max, level);
    const noCrit = !!l.noCrit;
    rows.push(damageRow({
      nBase, cBase: noCrit ? nBase : baseAtLevel(l.critMin, l.critMax, level), noCrit,
      critPct: clamp(stat(actor.stats, 'crit'), 0, 100), el: elementOf(spell, actor), actor: caster, me, st, input, berserk,
      mods: { tags: h.tags }, warn: noCrit ? ['sim.warn.noCrit'] : [],
    }));
  }
  return rows;
}

const unique = <T,>(xs: T[]): T[] => [...new Set(xs)];

const uncalculatedRow = (warnings: TKey[], mods?: CastMods): StepRow =>
  ({ kind: 'damage', value: zero(), tags: mods?.tags ?? [], ...withTagVars(mods), warnings, uncalculated: true });

const withTagVars = (mods?: CastMods) => (mods?.tagVars ? { tagVars: mods.tagVars } : {});

interface RowCtx {
  nBase: number; cBase: number; noCrit: boolean; critPct: number; el: Element; actor: SimActor; me: ActorState;
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
  // El daño extra de combo lo aporta la regla de clase en `mods.dmgPct`, solo en el último hechizo del combo.
  const dmgPct = Math.max(-100, stat(actor.stats, 'dmgPct') + (mods.dmgPct ?? 0));
  const res = (mob.res[c.el] ?? 0) + (position === 'back' ? mob.resBack : 0);
  const hit = (base: number, mastery: number, extraRes: number) => Math.max(0, damageValue({
    base, mastery: Math.max(-100, mastery), position, dmgPct, resPct: Math.min(100, resistancePct(res + extraRes)),
  }));
  const normal = hit(c.nBase, common, 0);
  const value = triple(normal, c.noCrit ? normal : hit(c.cBase, common + stat(actor.stats, 'mastCrit'), mob.resCrit), c.critPct);
  st.mobHp = Math.max(0, st.mobHp - value.avg);
  const tags: TKey[] = [melee ? 'sim.tag.melee' : 'sim.tag.dist'];
  if (position === 'side') tags.push('sim.tag.side');
  if (position === 'back') tags.push('sim.tag.back');
  if (c.berserk) tags.push('sim.tag.berserk');
  tags.push(...(mods.tags ?? []));
  return { kind: 'damage', value, position, tags: unique(tags), ...withTagVars(mods), warnings: c.warn };
}

function supportRow(c: RowCtx & {
  l: SpellLine; rState?: ActorState; rActor?: SimActor; onSelf: boolean;
}): StepRow {
  const { actor, me, mods, l, rState, rActor } = c;
  const tags: TKey[] = [];
  // Receptor ausente solo ocurre con datos incoherentes: se avisa en lugar de omitirse.
  if (!rState || !rActor) return { ...uncalculatedRow(c.warn, mods), kind: l.kind };

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
    const normal = heal(c.nBase, 0);
    raw = triple(normal, c.noCrit ? normal : heal(c.cBase, stat(actor.stats, 'mastCrit')), c.critPct);
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
  return { kind: l.kind, value, raw, tags: unique(tags), ...withTagVars(mods), warnings: c.warn };
}

/** Robo de vida: cura al lanzador un % del daño de las filas, limitada a los PV que faltan. */
function lifeStealRow(rows: StepRow[], pct: number, me: ActorState, actor: SimActor): StepRow | undefined {
  const hits = rows.filter((r) => r.kind === 'damage' && !r.uncalculated);
  if (hits.length === 0) return undefined;
  const sum = (k: keyof Triple) => floor(hits.reduce((s, r) => s + r.value[k], 0) * pct / 100);
  const raw: Triple = { normal: sum('normal'), crit: sum('crit'), avg: sum('avg') };
  const room = Math.max(0, actor.maxHp - me.hp);
  const value: Triple = { normal: Math.min(raw.normal, room), crit: Math.min(raw.crit, room), avg: Math.min(raw.avg, room) };
  me.hp += value.avg;
  me.healRes = addHealRes(me.healRes, value.avg, actor.maxHp);
  return { kind: 'heal', value, raw, tags: ['sim.tag.lifesteal'], warnings: [] };
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
  if (step.hpPct !== undefined) me.hp = Math.max(1, floor(clamp(step.hpPct, 0, 100) / 100 * actor.maxHp));
  if (step.armor !== undefined) me.armor = clamp(floor(step.armor), 0, addArmor(0, Infinity, actor.maxHp));
  if (step.facing) st.facing = step.facing;
  if (step.wp !== undefined) me.wp = clamp(floor(step.wp), 0, actor.wp);
  if (step.state) me.states[step.state.id] = Math.max(0, floor(step.state.levels));
  return done();
}

function endTurn(st: SimState, input: SimInput): Outcome {
  for (const actor of input.actors) {
    const s = st.actors[actor.id];
    if (!s) continue;
    s.ap = actor.ap; s.mp = actor.mp; s.uses = {};
    // Los PW no se rellenan: solo se recupera lo que cada personaje gana por turno, hasta su máximo.
    s.wp = Math.min(actor.wp, s.wp + (actor.wpPerTurn ?? 0));
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
    const mobWasDown = state.mobHp <= 0;
    const out =
      step.type === 'cast' ? castStep(step, next, input)
        : step.type === 'move' ? moveStep(step, next, input)
          : step.type === 'adjust' ? adjustStep(step, next, input)
            : endTurn(next, input);
    // Un paso rechazado no cambia nada: se conserva el estado anterior.
    if (out.ok) state = next;
    if (out.ok && step.type === 'cast') {
      // Los totales siguen sumando: la secuencia no se corta, pero el golpe se marca como de más.
      if (mobWasDown) for (const row of out.rows) if (row.kind === 'damage') row.tags = unique([...row.tags, 'sim.tag.mobDown']);
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
