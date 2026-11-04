// Sugerencia orientativa de sublimaciones según el rol, a partir de palabras clave de su efecto
// (efectos de wakfu.wiki.gg traducidos al español; no hay datos numéricos oficiales para modelarlos).
import { isDamageRole, type Role, type SubValue, type Sublimation } from './game';

export interface Focus { crit: boolean; back: boolean; berserk: boolean }

type Rule = [RegExp, (role: Role, f: Focus) => number];

const RULES: Rule[] = [
  [/daños infligidos|daños directos|% más de daño/, (r) => (isDamageRole(r) ? 3 : r === 'tank' ? 0.5 : 0)],
  [/crític/, (r, f) => (isDamageRole(r) ? (f.crit ? 3 : 1.5) : r === 'heal' ? 1 : 0)],
  [/espalda/, (r, f) => (isDamageRole(r) ? (f.back ? 3 : r === 'melee' ? 1 : 0) : 0)],
  [/berserker|menos del 50 % de pdv|por debajo del 50 %/, (_, f) => (f.berserk ? 3 : 0)],
  [/melé|cuerpo a cuerpo/, (r) => (r === 'melee' ? 2 : r === 'tank' ? 1 : r === 'dist' ? -2 : -1)],
  [/a distancia|\d+ casillas o más/, (r) => (r === 'dist' ? 2 : r === 'heal' ? 1 : r === 'melee' ? -2 : 0)],
  [/cura/, (r) => (r === 'heal' ? 3 : 0)],
  [/armadura dada|escudo/, (r) => (r === 'heal' ? 2 : 0)],
  [/resistencia|anticipación|barrera|armadura recibida|daños recibidos|daños sufridos/, (r) => (r === 'tank' ? 2.5 : 0.3)],
  [/anticipación|placaje/, (r) => (r === 'tank' ? 2 : 0)],
  [/puntos de vida|\bpdv\b/, (r) => (r === 'tank' ? 1.5 : 0.3)],
  [/\bpa\b|\bpm\b|\bpw\b|alcance/, () => 0.5],
];

/** Puntuación orientativa (más alta = más afín al rol). */
export function sublimationAffinity(s: Sublimation, role: Role, focus: Focus): number {
  const text = s.effect.join(' ').toLowerCase();
  let score = 0;
  for (const [re, w] of RULES) if (re.test(text)) score += w(role, focus);
  // Las frases que empiezan con penalización (-X% daño…) restan un poco.
  if (/(^|\s)-\d+ ?%? daños infligidos/.test(text)) score -= 1;
  return score;
}

/** Nombre base sin el sufijo de nivel (I, II, III). */
export const sublimationBase = (name: string) => name.replace(/\s+(I|II|III|IV)$/, '');

/** La sublimación épica o reliquia más afín al rol (para proponerla por defecto). */
export function bestSublimation(subs: Sublimation[], kind: 'epic' | 'relic', role: Role, focus: Focus): Sublimation | undefined {
  let best: Sublimation | undefined;
  let bestScore = -Infinity;
  for (const s of subs) {
    if (s.kind !== kind || !s.effect.length) continue;
    const sc = sublimationAffinity(s, role, focus);
    if (sc > bestScore || (sc === bestScore && best && s.name.localeCompare(best.name) < 0)) { best = s; bestScore = sc; }
  }
  return best;
}

// ---------- Efectos sobre las características ----------

export interface SubBonus { stats: Record<string, number>; zero: string[]; applied: { name: string; level: number }[] }

const valueAt = (v: [number, number] | number, level: number) =>
  typeof v === 'number' ? v : v[0] + v[1] * (level - 1);

/**
 * Suma de los efectos permanentes de las sublimaciones elegidas. Las iguales (mismo nombre base) suman su
 * nivel hasta el máximo si son acumulables; si no, cuenta la de mayor nivel. `total` da las características
 * de la build (para las sublimaciones con condición, p. ej. Pacto de Wakfu: 8 PW o más).
 */
export function sublimationBonus(chosen: Sublimation[], charLevel: number, total: (stat: string) => number): SubBonus {
  const groups = new Map<string, { sub: Sublimation; level: number }>();
  for (const s of chosen) {
    if (!s.stats) continue;
    const key = sublimationBase(s.nameEn);
    const g = groups.get(key);
    if (!g) groups.set(key, { sub: s, level: s.level });
    else {
      const sum = s.stackable ? g.level + s.level : Math.max(g.level, s.level);
      g.level = s.maxLevel ? Math.min(sum, s.maxLevel) : sum;
    }
  }
  const stats: Record<string, number> = {};
  const zero = new Set<string>();
  const applied: SubBonus['applied'] = [];
  for (const { sub, level } of groups.values()) {
    const { if: cond, zero: z, ...rest } = sub.stats!;
    if (cond) {
      const v = total(cond.s);
      if ((cond.min !== undefined && v < cond.min) || (cond.max !== undefined && v > cond.max)) continue;
    }
    for (const [k, raw] of Object.entries(rest as Record<string, SubValue>)) {
      const v = typeof raw === 'object' && !Array.isArray(raw)
        ? (valueAt(raw.lvl, level) / 100) * charLevel
        : valueAt(raw, level);
      stats[k] = (stats[k] ?? 0) + Math.floor(v);
    }
    z?.forEach((k) => zero.add(k));
    applied.push({ name: sublimationBase(sub.name), level });
  }
  return { stats, zero: [...zero], applied };
}
