// Sugerencia orientativa de sublimaciones según el rol, a partir de palabras clave de su efecto
// (efectos de wakfu.wiki.gg traducidos al español; no hay datos numéricos oficiales para modelarlos).
import { isDamageRole, type Role, type Sublimation } from './game';

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
