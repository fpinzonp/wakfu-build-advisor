// Recomendador de builds: puntúa una combinación de objetos según el rol y busca la mejor
// combinación con ascenso por coordenadas, reinicios aleatorios y respeto de las reglas del juego.
import { BUILD_SLOTS, CRAFT_FILTER_EXEMPT, EPIC, RELIC, isDamageRole, type BuildSlot, type Element, type Item, type Role } from './game';
import { planAptitudes, type AptitudePlan } from './aptitudes';
import type { DeckBonus } from './spells';
import { t } from './i18n';
import { condConflict, itemById, type CondState } from './conditions';

export interface BuildRequest {
  level: number;
  classId: string;           // para los objetos exclusivos de una clase
  role: Role;
  elements: Element[];
  targets: { ap: number; mp: number; range: number };
  allowedRarities: number[];
  minLevel: number;          // ignora objetos de nivel inferior (0 = todos)
  craftOnly: boolean;        // solo objetos con receta (salvo mascota y montura)
  berserk: boolean;          // contar el dominio berserker (Sacrógrito)
  crit: boolean;             // priorizar crítico (roles de daño)
  back: boolean;             // priorizar daños por la espalda (roles de daño)
  excluded: Set<number>;
  locked: BuildSlots;        // piezas elegidas a mano que el optimizador respeta
  deck?: DeckBonus;          // efectos permanentes de las pasivas equipadas
}

export type BuildSlots = Partial<Record<BuildSlot, Item>>;

export interface BuildResult {
  slots: BuildSlots;
  totals: Record<string, number>;
  derived: Derived;
  aptitudes: AptitudePlan;
  score: number;
}

export interface Derived {
  hp: number;
  mastery: number;       // dominio efectivo del rol en los elementos elegidos
  critChance: number;
  resPct: number;        // % de reducción media de daño por resistencias
  ehp: number;
  output: number;        // multiplicador de daño/cura esperado
}

// Claves internas del vector de puntuación
const K = [
  'hp', 'hpPct', 'ap', 'mp', 'wp', 'range', 'mastEff', 'mastMelee', 'mastDist', 'mastBack', 'mastCrit',
  'mastHeal', 'mastBerserk', 'crit', 'block', 'resAvg', 'resCrit', 'resBack', 'tackle', 'dodge', 'init', 'will',
  'armorGiven', 'armorReceived', 'dmgPct', 'healPct',
] as const;
const IDX = Object.fromEntries(K.map((k, i) => [k, i])) as Record<(typeof K)[number], number>;
const N = K.length;

const ELEMENT_KEYS: Record<Element, { mast: string; res: string }> = {
  fire: { mast: 'mastFire', res: 'resFire' },
  water: { mast: 'mastWater', res: 'resWater' },
  earth: { mast: 'mastEarth', res: 'resEarth' },
  air: { mast: 'mastAir', res: 'resAir' },
};

function toVector(stats: Record<string, number>, multiMast: Item['multiMast'], multiRes: Item['multiRes'], elements: Element[]) {
  const v = new Float64Array(N);
  const k = Math.max(1, elements.length);
  const s = (key: string) => stats[key] ?? 0;
  for (const key of ['hp', 'hpPct', 'ap', 'mp', 'wp', 'range', 'mastMelee', 'mastDist', 'mastBack', 'mastCrit',
    'mastHeal', 'mastBerserk', 'crit', 'block', 'resCrit', 'resBack', 'tackle', 'dodge', 'init', 'will', 'armorGiven',
    'armorReceived', 'dmgPct', 'healPct'] as const) v[IDX[key]] = s(key);
  // Dominio efectivo: elemental + media de los elementos elegidos + dominio en N elementos aleatorios
  // (el jugador elige los elementos, así que cubre min(n, k) de los k elementos de la build).
  let mast = s('mastElem') + elements.reduce((a, e) => a + s(ELEMENT_KEYS[e].mast), 0) / k;
  if (multiMast) mast += (multiMast.v * Math.min(multiMast.n, k)) / k;
  v[IDX.mastEff] = mast;
  // Resistencia media frente a los 4 elementos
  let res = s('resElem') + (s('resFire') + s('resWater') + s('resEarth') + s('resAir')) / 4;
  if (multiRes) res += (multiRes.v * Math.min(multiRes.n, 4)) / 4;
  v[IDX.resAvg] = res;
  return v;
}

// Valor de cada punto de recurso [hasta el objetivo, por encima del objetivo]
type ResourceWeight = [below: number, above: number];

interface RoleWeights {
  output: number; survival: number;
  mastery: (t: Float64Array) => number;
  ap: ResourceWeight; mp: ResourceWeight;
  misc: Partial<Record<(typeof K)[number], number>>;
}

// Daños: casi todo el peso en daño y los PA siempre por delante de los PM.
// Curas: dominio de cura + distancia. Tanque: anticipación, resistencias y vida, con PM por delante de PA.
const ROLE_WEIGHTS: Record<Role, RoleWeights> = {
  dist: {
    output: 1, survival: 0.25,
    mastery: (t) => t[IDX.mastEff] + t[IDX.mastDist],
    ap: [0.14, 0.05], mp: [0.05, 0.008],
    misc: { dodge: 0.00005, init: 0.00003, will: 0.0002, armorReceived: 0.001 },
  },
  melee: {
    output: 1, survival: 0.25,
    mastery: (t) => t[IDX.mastEff] + t[IDX.mastMelee] + 0.5 * t[IDX.mastBack],
    ap: [0.14, 0.05], mp: [0.06, 0.01],
    misc: { tackle: 0.00005, dodge: 0.00005, init: 0.00003, will: 0.0002, armorReceived: 0.001 },
  },
  heal: {
    output: 1, survival: 0.4,
    mastery: (t) => t[IDX.mastEff] + t[IDX.mastHeal] + t[IDX.mastDist],
    ap: [0.13, 0.04], mp: [0.05, 0.008],
    // Bono extra al dominio cura: a igualdad gana la pieza de cura; si en una ranura
    // no hay piezas de cura, el dominio distancia (ya incluido en `mastery`) decide.
    misc: { mastHeal: 0.00005, dodge: 0.00005, init: 0.00003, armorGiven: 0.004, resCrit: 0.0002, armorReceived: 0.002 },
  },
  tank: {
    output: 0.2, survival: 1.6,
    mastery: (t) => t[IDX.mastEff] + t[IDX.mastMelee],
    ap: [0.07, 0.01], mp: [0.12, 0.04],
    misc: {
      block: 0.006, resAvg: 0.0006, tackle: 0.0003, will: 0.0005, init: 0.00003,
      resCrit: 0.0008, resBack: 0.0004, armorReceived: 0.005,
    },
  },
};

type DeriveOptions = Pick<BuildRequest, 'role' | 'level' | 'berserk' | 'back'>;

export function derive(t: Float64Array, { role, level, berserk, back }: DeriveOptions): Derived {
  const w = ROLE_WEIGHTS[role];
  const hp = (50 + 10 * level + t[IDX.hp]) * (1 + t[IDX.hpPct] / 100);
  const c = Math.min(Math.max(t[IDX.crit], 0), 100) / 100;
  const damage = isDamageRole(role);
  // Berserker: se juega por debajo del 50 % de PdV, así que su dominio cuenta entero en los roles de daño.
  // Espalda priorizada (Sram, Ocra…): el dominio espalda cuenta casi como dominio general.
  const m = w.mastery(t)
    + (berserk && damage ? t[IDX.mastBerserk] : 0)
    + (back && damage ? (role === 'melee' ? 0.4 : 0.6) * t[IDX.mastBack] : 0);
  const base = Math.max(0.1, 1 + m / 100);
  const crit = Math.max(0.1, 1 + (m + t[IDX.mastCrit]) / 100) * 1.25;
  // "% daños infligidos" no afecta a las curas; "% curas realizadas" sí.
  const pctBonus = role === 'heal' ? t[IDX.healPct] : t[IDX.dmgPct];
  const output = ((1 - c) * base + c * crit) * (1 + pctBonus / 100);
  // Wakfu: % de reducción = 1 - 0,8^(resistencia/100), con tope del 90 %
  const resPct = Math.min(0.9, 1 - Math.pow(0.8, t[IDX.resAvg] / 100));
  const block = Math.min(Math.max(t[IDX.block], 0), 100) / 100;
  const ehp = Math.max(1, hp) / (1 - resPct) / (1 - 0.2 * block);
  return { hp, mastery: m, critChance: c * 100, resPct: resPct * 100, ehp, output };
}

function score(t: Float64Array, req: BuildRequest): number {
  const w = ROLE_WEIGHTS[req.role];
  const d = derive(t, req);
  let s = w.output * Math.log(d.output) + w.survival * Math.log(d.ehp);
  // Crítico priorizado: además del daño esperado, premia % crítico y dominio crítico.
  if (req.crit && isDamageRole(req.role)) {
    s += 0.004 * Math.min(Math.max(t[IDX.crit], 0), 100) + 0.0001 * t[IDX.mastCrit];
  }
  // Recursos: muy valiosos hasta el objetivo, poco valiosos por encima.
  const res = (val: number, target: number, below: number, above: number) =>
    val <= target ? val * below : target * below + (val - target) * above;
  s += res(t[IDX.ap], req.targets.ap, ...w.ap);
  s += res(t[IDX.mp], req.targets.mp, ...w.mp);
  if (req.targets.range > 0) s += res(t[IDX.range], req.targets.range, 0.05, 0.004);
  s += 0.004 * t[IDX.wp];
  for (const [k, wt] of Object.entries(w.misc)) s += wt! * t[IDX[k as (typeof K)[number]]];
  return s;
}

interface Cand { item: Item; vec: Float64Array; twoHanded: boolean }

function baseVector(bonus: Record<string, number>, elements: Element[]) {
  const stats: Record<string, number> = { ap: 6, mp: 3, wp: 6, crit: 3 };
  for (const [k, v] of Object.entries(bonus)) stats[k] = (stats[k] ?? 0) + v;
  return toVector(stats, undefined, undefined, elements);
}

const SLOT_IDS = BUILD_SLOTS.map((s) => s.id);

function context(req: BuildRequest) {
  const aptitudes = planAptitudes(req.role, req.level, req);
  const bonus = { ...aptitudes.bonus };
  for (const [k, v] of Object.entries(req.deck?.stats ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
  return { aptitudes, base: baseVector(bonus, req.elements) };
}

const itemVector = (item: Item, req: BuildRequest) => toVector(item.stats, item.multiMast, item.multiRes, req.elements);

// Motivo por el que una combinación no es válida, o null si lo es.
// Con `req` se comprueban también las condiciones de cada objeto, y con `total` sus umbrales de características.
function conflict(get: (s: BuildSlot) => Item | undefined, req?: BuildRequest, total?: CondState['total']): string | null {
  let relics = 0, epics = 0;
  for (const s of SLOT_IDS) {
    const r = get(s)?.rarity;
    if (r === RELIC) relics++;
    if (r === EPIC) epics++;
  }
  if (relics > 1) return t('conflict.relic');
  if (epics > 1) return t('conflict.epic');
  const r1 = get('ring1'), r2 = get('ring2');
  if (r1 && r2 && r1.name === r2.name) return t('conflict.rings');
  if (get('weapon')?.slot === 'weapon2h' && get('offhand')) return t('conflict.twoHanded');
  if (!req) return null;
  const equipped = SLOT_IDS.map(get);
  return condConflict(equipped, {
    equipped: (id) => equipped.some((i) => i?.id === id),
    total: total ?? (() => undefined),
    classId: req.classId,
  });
}

const vectorTotal = (t: Float64Array) => (k: string) => (k in IDX ? t[IDX[k as (typeof K)[number]]] : undefined);

/** Ranura donde equipar `needed` sin tocar `except` (prefiere una vacía). */
function slotFor(slots: Partial<Record<BuildSlot, unknown>>, needed: Item, except: BuildSlot): BuildSlot | undefined {
  const options = BUILD_SLOTS.filter((s) => s.id !== except && s.accepts.includes(needed.slot)).map((s) => s.id);
  return options.find((s) => !slots[s]) ?? options[options.length - 1];
}

function summarize(slots: BuildSlots, req: BuildRequest, ctx = context(req), extra: Record<string, number> = {}): BuildResult {
  const t = ctx.base.slice();
  const totals: Record<string, number> = { ap: 6, mp: 3, wp: 6, crit: 3 };
  const add = (k: string, v: number) => { totals[k] = (totals[k] ?? 0) + v; };
  for (const [k, v] of Object.entries(ctx.aptitudes.bonus)) add(k, v);
  for (const [k, v] of Object.entries(req.deck?.stats ?? {})) add(k, v);
  // Stats extra (runas) que no pertenecen a ningún objeto
  const ev = toVector(extra, undefined, undefined, req.elements);
  for (let i = 0; i < N; i++) t[i] += ev[i];
  for (const [k, v] of Object.entries(extra)) add(k, v);
  for (const s of SLOT_IDS) {
    const item = slots[s];
    if (!item) continue;
    const v = itemVector(item, req);
    for (let i = 0; i < N; i++) t[i] += v[i];
    for (const [k, val] of Object.entries(item.stats)) add(k, val);
  }
  // Pasivas que dejan una característica a 0 (p. ej. "esquiva a 0 al inicio del combate")
  for (const k of req.deck?.zero ?? []) {
    totals[k] = 0;
    if (k in IDX) t[IDX[k as (typeof K)[number]]] = 0;
  }
  return {
    slots, totals, aptitudes: ctx.aptitudes,
    derived: derive(t, req), score: score(t, req),
  };
}

/** Recalcula una build elegida a mano (sin optimizar), opcionalmente con stats extra (runas). */
export function evaluateBuild(slots: BuildSlots, req: BuildRequest, extra?: Record<string, number>): BuildResult {
  return summarize(slots, req, context(req), extra);
}

/** Pone un objeto en una ranura; un arma a dos manos libera la segunda mano y un objeto que exige otro
 * (espada de nación -> su anillo) lo equipa también, quitando la reliquia o el épico que choque con él. */
export function swapItem(slots: BuildSlots, slot: BuildSlot, item: Item | undefined): BuildSlots {
  const next = { ...slots, [slot]: item };
  if (!item) delete next[slot];
  if (slot === 'weapon' && item?.slot === 'weapon2h') delete next.offhand;
  for (const needed of item ? requiredItems(next, item) : []) {
    // Primero se quita la reliquia/el épico que choca (p. ej. el anillo de otra nación) para reutilizar su ranura.
    if (needed.rarity === RELIC || needed.rarity === EPIC) {
      for (const s of SLOT_IDS) if (s !== slot && next[s]?.rarity === needed.rarity) delete next[s];
    }
    const target = slotFor(next, needed, slot);
    if (target) next[target] = needed;
  }
  return next;
}

/** Objetos que `swapItem` equiparía además de `item` porque `item` los exige. */
export const requiredItems = (slots: BuildSlots, item: Item): Item[] =>
  (item.cond ?? []).flatMap((c) => {
    if (!('needs' in c) || SLOT_IDS.some((s) => slots[s]?.id === c.needs)) return [];
    const needed = itemById(c.needs);
    return needed ? [needed] : [];
  });

export interface Alternative {
  item: Item;
  result: BuildResult | null;   // null si la combinación no es válida
  reason: string | null;
  delta: number;                // diferencia de puntuación frente a la build actual
}

/** Ordena las alternativas para una ranura según cómo dejarían la build actual. */
export function rankAlternatives(candidates: Item[], current: BuildResult, slot: BuildSlot, req: BuildRequest): Alternative[] {
  const ctx = context(req);
  return candidates
    .map((item) => {
      const slots = swapItem(current.slots, slot, item);
      let reason = conflict((s) => slots[s], req);
      let result = reason ? null : summarize(slots, req, ctx);
      if (result) {
        const totals = result.totals;
        reason = conflict((s) => slots[s], req, (k) => totals[k] ?? 0);
        if (reason) result = null;
      }
      return { item, result, reason, delta: result ? result.score - current.score : -Infinity };
    })
    .sort((a, b) => b.delta - a.delta);
}

// Generador pseudoaleatorio con semilla para resultados reproducibles
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function recommend(items: Item[], req: BuildRequest): BuildResult {
  const ctx = context(req);
  const { base } = ctx;
  const allowed = new Set(req.allowedRarities);

  const pool = items.filter((i) => i.lvl <= req.level && i.lvl >= req.minLevel
    && allowed.has(i.rarity) && !req.excluded.has(i.id)
    && (!req.craftOnly || i.src === 'craft' || CRAFT_FILTER_EXEMPT.includes(i.slot))
    && !i.cond?.some((c) => 'cls' in c && c.cls !== req.classId));
  const poolById = new Map(pool.map((i) => [i.id, i]));

  const slotIds = SLOT_IDS;
  const isLocked = (s: BuildSlot) => req.locked[s] !== undefined;
  const baseScore = score(base, req);

  // Candidatos por ranura, preseleccionados por su aporte marginal y por recursos clave.
  const cands = {} as Record<BuildSlot, Cand[]>;
  for (const slot of BUILD_SLOTS) {
    const list = pool.filter((i) => slot.accepts.includes(i.slot)).map((item) => ({
      item, vec: toVector(item.stats, item.multiMast, item.multiRes, req.elements), twoHanded: item.slot === 'weapon2h',
    }));
    const marginal = (c: Cand) => {
      const t = base.slice();
      for (let i = 0; i < N; i++) t[i] += c.vec[i];
      return score(t, req) - baseScore;
    };
    const ranked = list.map((c) => ({ c, m: marginal(c) })).sort((a, b) => b.m - a.m);
    const keep = new Set(ranked.slice(0, 40).map((r) => r.c));
    for (const key of ['ap', 'mp', 'range'] as const) {
      list.filter((c) => c.vec[IDX[key]] > 0)
        .sort((a, b) => b.vec[IDX[key]] - a.vec[IDX[key]] || marginal(b) - marginal(a))
        .slice(0, 6).forEach((c) => keep.add(c));
    }
    cands[slot.id] = [...keep];
    const locked = req.locked[slot.id];
    if (locked) cands[slot.id] = [{ item: locked, vec: itemVector(locked, req), twoHanded: locked.slot === 'weapon2h' }];
  }

  // Los objetos que exige otro candidato (anillo de nación) también son candidatos de su ranura.
  const needs = Object.values(cands).flat().flatMap((c) => c.item.cond ?? [])
    .flatMap((c) => ('needs' in c && poolById.get(c.needs)) || []);
  for (const slot of BUILD_SLOTS) {
    if (isLocked(slot.id)) continue;
    for (const needed of needs) {
      if (!slot.accepts.includes(needed.slot) || cands[slot.id].some((x) => x.item === needed)) continue;
      cands[slot.id].push({ item: needed, vec: itemVector(needed, req), twoHanded: false });
    }
  }

  type Assign = Partial<Record<BuildSlot, Cand>>;

  const totalsOf = (a: Assign) => {
    const t = base.slice();
    for (const s of slotIds) {
      const c = a[s];
      if (c) for (let i = 0; i < N; i++) t[i] += c.vec[i];
    }
    return t;
  };

  // Válida si cumple las reglas del juego y conserva las piezas fijadas.
  const valid = (a: Assign, t?: Float64Array) =>
    conflict((s) => a[s]?.item, req, t && vectorTotal(t)) === null
    && slotIds.every((s) => !isLocked(s) || a[s]?.item === req.locked[s]);

  const lockedStart = (): Assign => {
    const a: Assign = {};
    for (const s of slotIds) if (isLocked(s)) a[s] = cands[s][0];
    return a;
  };

  // Al poner c en la ranura, libera conflictos (2 manos, reliquia/épico duplicado)
  // y equipa también el objeto que c exige (espada de nación -> su anillo).
  const place = (a: Assign, slot: BuildSlot, c: Cand | undefined): Assign => {
    let next: Assign = { ...a, [slot]: c };
    if (slot === 'weapon' && c?.twoHanded) delete next.offhand;
    if (slot === 'offhand' && c && next.weapon?.twoHanded) delete next.weapon;
    const r = c?.item.rarity;
    if (r === RELIC || r === EPIC) {
      for (const s of slotIds) if (s !== slot && next[s]?.item.rarity === r) delete next[s];
    }
    for (const cond of c?.item.cond ?? []) {
      if (!('needs' in cond) || slotIds.some((s) => next[s]?.item.id === cond.needs)) continue;
      const needed = poolById.get(cond.needs);
      if (!needed) continue;
      // La ranura de la reliquia/el épico que el objeto necesario desplazaría cuenta como libre.
      const free = { ...next };
      for (const s of slotIds) if (s !== slot && free[s]?.item.rarity === needed.rarity && !isLocked(s)) delete free[s];
      const target = slotFor(free, needed, slot);
      const nc = target && !isLocked(target) ? cands[target].find((x) => x.item === needed) : undefined;
      if (nc && target) next = place(next, target, nc);
    }
    return next;
  };

  const evalA = (a: Assign) => {
    if (!valid(a)) return -Infinity;
    const t = totalsOf(a);
    return valid(a, t) ? score(t, req) : -Infinity;
  };

  const fillEmpty = (a: Assign) => {
    for (const s of slotIds) {
      if (a[s]) continue;
      if (s === 'offhand' && a.weapon?.twoHanded) continue;
      let best = a, bestScore = evalA(a);
      for (const c of cands[s]) {
        if (c.item.rarity === RELIC || c.item.rarity === EPIC) {
          if (slotIds.some((o) => a[o]?.item.rarity === c.item.rarity)) continue;
        }
        if (s === 'weapon' && c.twoHanded && a.offhand) continue;
        const n = { ...a, [s]: c };
        const sc = evalA(n);
        if (sc > bestScore) { best = n; bestScore = sc; }
      }
      a = best;
    }
    return a;
  };

  const climb = (start: Assign, rand: () => number) => {
    let cur = fillEmpty(start);
    let curScore = evalA(cur);
    for (let iter = 0; iter < 25; iter++) {
      let improved = false;
      const order = slotIds.filter((s) => !isLocked(s)).sort(() => rand() - 0.5);
      for (const s of order) {
        for (const c of [undefined, ...cands[s]]) {
          const n = fillEmpty(place(cur, s, c));
          const sc = evalA(n);
          if (sc > curScore + 1e-9) { cur = n; curScore = sc; improved = true; }
        }
      }
      // Movimiento combinado arma + segunda mano
      const oneH = isLocked('weapon') || isLocked('offhand') ? [] : cands.weapon.filter((c) => !c.twoHanded).slice(0, 15);
      for (const w of oneH) {
        for (const o of cands.offhand.slice(0, 15)) {
          const n = place(place(cur, 'weapon', w), 'offhand', o);
          const sc = evalA(n);
          if (sc > curScore + 1e-9) { cur = n; curScore = sc; improved = true; }
        }
      }
      if (!improved) break;
    }
    return { a: cur, score: curScore };
  };

  let best = climb(lockedStart(), rng(1));
  for (let r = 2; r <= 7; r++) {
    const rand = rng(r * 7919);
    // Reinicio: partir de una selección aleatoria entre los mejores candidatos de cada ranura
    const start: Assign = lockedStart();
    for (const s of slotIds) {
      if (isLocked(s)) continue;
      const list = cands[s];
      if (list.length && rand() < 0.7) {
        const pick = list[Math.floor(rand() * Math.min(list.length, 12))];
        const n = place(start, s, pick);
        Object.keys(start).forEach((k) => delete start[k as BuildSlot]);
        Object.assign(start, n);
      }
    }
    const res = climb(valid(start) ? start : lockedStart(), rand);
    if (res.score > best.score) best = res;
  }

  const slots: BuildSlots = {};
  for (const s of slotIds) if (best.a[s]) slots[s] = best.a[s]!.item;
  return summarize(slots, req, ctx);
}
