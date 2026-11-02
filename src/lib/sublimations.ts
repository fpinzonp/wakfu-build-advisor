// Sugerencia orientativa de sublimaciones según el rol, a partir de palabras clave de su efecto
// (los efectos vienen en inglés de wakfu.wiki.gg; no hay datos numéricos oficiales para modelarlos).
import { isDamageRole, type Role, type Sublimation } from './game';

export interface Focus { crit: boolean; back: boolean; berserk: boolean }

type Rule = [RegExp, (role: Role, f: Focus) => number];

const RULES: Rule[] = [
  [/damage inflicted|damage dealt|final damage/, (r) => (isDamageRole(r) ? 3 : r === 'tank' ? 0.5 : 0)],
  [/critical/, (r, f) => (isDamageRole(r) ? (f.crit ? 3 : 1.5) : r === 'heal' ? 1 : 0)],
  [/\brear\b|\bback\b|backstab/, (r, f) => (isDamageRole(r) ? (f.back ? 3 : r === 'melee' ? 1 : 0) : 0)],
  [/berserk|below 50% (of )?(hp|health)/, (_, f) => (f.berserk ? 3 : 0)],
  [/melee|close.combat/, (r) => (r === 'melee' ? 2 : r === 'tank' ? 1 : r === 'dist' ? -2 : -1)],
  [/distance|long.range|ranged/, (r) => (r === 'dist' ? 2 : r === 'heal' ? 1 : r === 'melee' ? -2 : 0)],
  [/heal/, (r) => (r === 'heal' ? 3 : 0)],
  [/armor given|shield/, (r) => (r === 'heal' ? 2 : 0)],
  [/resistance|block|barrier|armor received|damage received|damage suffered/, (r) => (r === 'tank' ? 2.5 : 0.3)],
  [/\block\b|tackle/, (r) => (r === 'tank' ? 2 : 0)],
  [/health points|\bhp\b/, (r) => (r === 'tank' ? 1.5 : 0.3)],
  [/\bap\b|\bmp\b|\bwp\b|range/, () => 0.5],
];

/** Puntuación orientativa (más alta = más afín al rol). */
export function sublimationAffinity(s: Sublimation, role: Role, focus: Focus): number {
  const text = s.effect.join(' ').toLowerCase();
  let score = 0;
  for (const [re, w] of RULES) if (re.test(text)) score += w(role, focus);
  // Las frases que empiezan con penalización (-X% daño…) restan un poco.
  if (/(^|\s)-\d+%? damage inflicted/.test(text)) score -= 1;
  return score;
}

/** Nombre base sin el sufijo de nivel (I, II, III). */
export const sublimationBase = (name: string) => name.replace(/\s+(I|II|III|IV)$/, '');
