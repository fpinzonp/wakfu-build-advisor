// Reglas del Tymador para el simulador.
import type { ClassRules, SimActor } from '../engine';

/** Pasiva innata: convierte el dominio melé en distancia y viceversa, así que cada golpe usa la suma de ambos. */
function statsFor(actor: SimActor): Record<string, number> {
  const both = (actor.stats.mastMelee ?? 0) + (actor.stats.mastDist ?? 0);
  return { ...actor.stats, mastMelee: both, mastDist: both };
}

export const rogueRules: ClassRules = { statsFor };
