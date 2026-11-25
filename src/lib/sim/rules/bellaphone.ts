// Bellaphone (1.94): la Bellaura de su linaje. Datos del devblog oficial (25/11/2026), aún sin comprobar en el juego.
// Los hechizos, pasivas y mejoras por nivel de linaje no se publicaron: llegarán desde la wiki y no se modelan aquí.

export const BELLAPHONE = 'bellaphone';

export type Lineage = 'emeraude' | 'pourpre' | 'turquoise' | 'ocre' | 'ivoire' | 'ebene';
export const LINEAGES: Lineage[] = ['pourpre', 'turquoise', 'ocre', 'emeraude', 'ivoire', 'ebene'];
/** Linaje por defecto del juego. */
export const DEFAULT_LINEAGE: Lineage = 'pourpre';

/** Efectos al activarse la Bellaura, con signo. `res` es resistencia elemental. */
export interface AuraEffect { ap?: number; mp?: number; wp?: number; range?: number; dmgPct?: number; crit?: number; res?: number }

/**
 * Efecto de cada linaje sobre todos los combatientes de la zona, aliados y enemigos. El Bellaphone recibe lo positivo
 * e ignora lo negativo. Turquesa también quita un 25 % de parada y Ébano un 25 % de parada: no cambian el daño infligido.
 * Ocre "evoluciona según el nivel", pero el mismo devblog dice que la Bellaura no cambia con el linaje: se usa -2.
 */
export const AURA: Record<Lineage, AuraEffect> = {
  emeraude: { mp: 2, range: 2 },
  pourpre: { dmgPct: 25, crit: 25 },
  turquoise: { dmgPct: -15, crit: -25 },
  ocre: { mp: -2, range: -2 },
  ivoire: { ap: 2, wp: 1 },
  ebene: { res: -100 },
};

/** Zona de la Bellaura: círculo de tamaño 2 alrededor del Bellaphone. */
export const AURA_RADIUS = 2;

/** Claves de estado de la Bellaura activa en un personaje; se vacían al terminar el turno. */
export const AURA_STATE = { used: 'aura.used', dmgPct: 'aura.dmgPct', crit: 'aura.crit', range: 'aura.range', on: 'aura.on' } as const;

/** Lo que recibe un combatiente: el Bellaphone se queda solo con los efectos positivos. */
export function auraFor(lineage: Lineage, isCaster: boolean): AuraEffect {
  const fx = AURA[lineage];
  if (!isCaster) return fx;
  return Object.fromEntries(Object.entries(fx).filter(([, v]) => (v ?? 0) > 0)) as AuraEffect;
}
