import type { Spell } from '../spells';
import { isCasterCentred } from './formulas';
import type { CastTarget } from './engine';

/**
 * Objetivo automático de un hechizo. Va al mob si tiene un efecto sobre enemigos en cualquier parte (líneas normales,
 * de berserker o de una rama condicional); si no, los que tienen efectos sobre aliados van al otro personaje cuando
 * hay uno y el resto, sobre uno mismo. Con alcance 0 y sin zona solo se pueden lanzar sobre uno mismo.
 */
export const castTarget = (s: Spell, hasAlly: boolean): CastTarget => {
  const c = s.cast;
  if (c && c.rangeMax === 0 && !isCasterCentred(c)) return 'self';
  const lines = [...(c?.lines ?? []), ...(c?.berserkLines ?? []), ...(c?.conditional ?? []).flatMap((b) => b.lines)];
  if (lines.length === 0 || lines.some((l) => l.side === 'enemy')) return 'mob';
  return hasAlly && lines.some((l) => l.side === 'ally') ? 'ally' : 'self';
};
