// Cobertura por mazmorra: qué mazmorras cubre un equipo de 6, el mejor equipo base y el cambio de una clase que
// arregla una mazmorra sin cubrir. Las exigencias vienen de dungeons/requirements.ts.
import { CLASSES, isDamageRole } from './game';
import { DUNGEONS, byTier } from './dungeons';
import { needsOf, type DungeonNeeds, type Requirement } from './dungeons/requirements';
import {
  bestRole, memberPlaces, memberPower, scoreTeam, searchTeam, type Member, type Need, type PlaceKind,
} from './teams';

type NeedsFn = (id: string) => DungeonNeeds;

// Cachés: memberPower y memberPlaces solo dependen de clase y rol (KIT es fijo), y se llaman miles de veces
// al buscar el equipo base y los cambios sugeridos.
const key = (m: Member) => `${m.classId}:${m.role}`;
const powers = new Map<string, Record<Need, number>>();
const places = new Map<string, Map<PlaceKind, number>>();
const powerOf = (m: Member) => {
  let p = powers.get(key(m));
  if (!p) { p = memberPower(m); powers.set(key(m), p); }
  return p;
};
const placesOf = (m: Member) => {
  let p = places.get(key(m));
  if (!p) { p = memberPlaces(m); places.set(key(m), p); }
  return p;
};

// Igual que coverage() de teams.ts para una sola necesidad: el mejor aporte y una cuarta parte del segundo.
function coverageOf(group: Member[], need: Need): number {
  let a = 0;
  let b = 0;
  for (const m of group) {
    const v = powerOf(m)[need];
    if (v > a) { b = a; a = v; } else if (v > b) b = v;
  }
  return Math.min(3, a + b / 4);
}

/** Exigencia sintética que se añade a `missing` cuando el grupo no tiene a nadie con rol de daño. */
export const MISSING_DAMAGE: Requirement = {
  need: 'melee',
  required: true,
  why: { es: 'Falta un personaje que haga daño.', en: 'Missing a damage dealer.', fr: 'Il manque un personnage qui inflige des dégâts.' },
};

/** Si el grupo cumple una exigencia. Con `place` o `count > 1` cuenta personajes que la cumplen por sí solos. */
export function meets(group: Member[], r: Requirement): boolean {
  const t = r.level ?? 2;
  const count = r.count ?? 1;
  if (r.place || count > 1) {
    // Con una lista de subtipos basta con que el personaje llegue al umbral en cualquiera de ellos.
    const kinds = r.place === undefined ? [] : Array.isArray(r.place) ? r.place : [r.place];
    const ok = group.filter((m) => powerOf(m)[r.need] >= t
      && (kinds.length === 0 || kinds.some((k) => (placesOf(m).get(k) ?? 0) >= t)));
    return ok.length >= count;
  }
  return coverageOf(group, r.need) >= t;
}

export interface DungeonResult { id: string; covered: boolean; missing: Requirement[]; group: Member[]; recommendedMet: number }

// Subgrupos de `size` que incluyen team[0], en orden de aparición.
function subgroups(team: Member[], size: number): Member[][] {
  const out: Member[][] = [];
  const rest = team.slice(1);
  const pick = (start: number, cur: Member[]) => {
    if (cur.length === size - 1) { out.push([team[0], ...cur]); return; }
    for (let i = start; i < rest.length; i++) pick(i + 1, [...cur, rest[i]]);
  };
  pick(0, []);
  return out;
}

function evaluate(group: Member[], id: string, reqs: Requirement[]): DungeonResult {
  const missing = reqs.filter((r) => r.required && !meets(group, r));
  if (!group.some((m) => isDamageRole(m.role))) missing.push(MISSING_DAMAGE);
  const recommendedMet = reqs.filter((r) => !r.required && meets(group, r)).length;
  return { id, covered: missing.length === 0, missing, group, recommendedMet };
}

/**
 * Resultado de una mazmorra. Si es de menos de 6 se elige, entre los subgrupos que incluyen al usuario (team[0]),
 * el que deja menos obligatorias sin cumplir (la falta de daño cuenta como una), luego más recomendadas y luego
 * mayor puntuación general.
 */
export function dungeonResult(team: Member[], id: string, needs: NeedsFn = needsOf): DungeonResult {
  const { size, reqs } = needs(id);
  if (team.length <= size) return evaluate(team, id, reqs);
  let best: DungeonResult | null = null;
  let bestScore = -Infinity;
  for (const g of subgroups(team, size)) {
    const r = evaluate(g, id, reqs);
    if (best && (r.missing.length > best.missing.length
      || (r.missing.length === best.missing.length && r.recommendedMet < best.recommendedMet))) continue;
    const s = scoreTeam(g);
    if (best && r.missing.length === best.missing.length && r.recommendedMet === best.recommendedMet && s <= bestScore + 1e-9) continue;
    best = r;
    bestScore = s;
  }
  return best!;
}

export interface TeamReport {
  covered: number;
  total: number;
  tiers: { tier: [number, number]; covered: number; total: number; results: DungeonResult[] }[];
}

/** Cobertura del equipo en todas las mazmorras, agrupada por las franjas de `byTier()`. */
export function teamReport(team: Member[], needs: NeedsFn = needsOf): TeamReport {
  const tiers = byTier().map(({ tier, dungeons }) => {
    const results = dungeons.map((d) => dungeonResult(team, d.id, needs));
    return { tier, covered: results.filter((r) => r.covered).length, total: results.length, results };
  });
  return {
    covered: tiers.reduce((s, t) => s + t.covered, 0),
    total: tiers.reduce((s, t) => s + t.total, 0),
    tiers,
  };
}

// Resumen de un equipo (mazmorras cubiertas y puntuación base), memorizado por función de exigencias y equipo:
// suggestFix para varias mazmorras prueba casi los mismos cambios, y la búsqueda repite equipos.
// El orden importa solo en team[0] (el usuario), así que el resto se ordena en la clave.
interface Summary { covered: number; score: number }
const summaries = new WeakMap<NeedsFn, Map<string, Summary>>();
const MAX_SUMMARIES = 20000;

function summary(team: Member[], needs: NeedsFn): Summary {
  let cache = summaries.get(needs);
  if (!cache) { cache = new Map(); summaries.set(needs, cache); }
  const k = team.length ? `${key(team[0])}|${team.slice(1).map(key).sort().join(',')}` : '';
  let s = cache.get(k);
  if (!s) {
    let covered = 0;
    let recommended = 0;
    for (const d of DUNGEONS) {
      const r = dungeonResult(team, d.id, needs);
      if (r.covered) covered++;
      recommended += r.recommendedMet;
    }
    s = { covered, score: 1000 * covered + 10 * recommended + scoreTeam(team) };
    if (cache.size >= MAX_SUMMARIES) cache.clear();
    cache.set(k, s);
  }
  return s;
}

/** Puntuación del equipo base: 1000 por mazmorra cubierta + 10 por recomendada cumplida + puntuación general. */
export const baseScore = (team: Member[], needs: NeedsFn = needsOf): number => summary(team, needs).score;

/** Equipo base de 6 que incluye a los fijados (fixed[0] = el usuario) y cubre más mazmorras. */
export const recommendBaseTeam = (fixed: Member[], needs: NeedsFn = needsOf): Member[] =>
  searchTeam(fixed, 6, (t) => baseScore(t, needs));

export interface Fix { index: number; member: Member; total: number }

/**
 * Cambio de una sola clase (nunca la del usuario ni una que ya está) que deja cubierta la mazmorra `id`; entre
 * ellos, el que deja más mazmorras cubiertas en total (empate: mayor `baseScore`). `null` si ninguno la arregla.
 */
export function suggestFix(team: Member[], id: string, needs: NeedsFn = needsOf): Fix | null {
  let best: Fix | null = null;
  let bestScore = -Infinity;
  for (let index = 1; index < team.length; index++) {
    for (const cl of CLASSES) {
      if (team.some((m) => m.classId === cl.id)) continue;
      const member: Member = { classId: cl.id, role: bestRole(cl.id, team, index) };
      const after = team.map((m, i) => (i === index ? member : m));
      if (!dungeonResult(after, id, needs).covered) continue;
      const { covered: total, score: s } = summary(after, needs);
      if (best && total < best.total) continue;
      if (best && total === best.total && s <= bestScore + 1e-9) continue;
      best = { index, member, total };
      bestScore = s;
    }
  }
  return best;
}

/** Mazmorras que pasan a estar cubiertas (`gained`) o dejan de estarlo (`lost`) al cambiar de equipo. */
export function dungeonDiff(before: Member[], after: Member[], needs: NeedsFn = needsOf): { gained: string[]; lost: string[] } {
  const gained: string[] = [];
  const lost: string[] = [];
  for (const d of DUNGEONS) {
    const a = dungeonResult(before, d.id, needs).covered;
    const b = dungeonResult(after, d.id, needs).covered;
    if (!a && b) gained.push(d.id);
    if (a && !b) lost.push(d.id);
  }
  return { gained, lost };
}
