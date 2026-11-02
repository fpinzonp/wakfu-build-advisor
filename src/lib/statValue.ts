// Valor marginal de cada característica para la build actual: cuánto mejora si se añade una cantidad fija.
import type { Role } from './game';
import { evaluateBuild, type BuildRequest, type BuildSlots } from './optimizer';

export interface StatProbe { key: string; amount: number; label: string; roles?: Role[] }

// Cantidades de referencia, parecidas a lo que suele variar entre dos piezas.
export const PROBES: StatProbe[] = [
  { key: 'mastElem', amount: 100, label: '+100 Dominio elemental' },
  { key: 'mastHeal', amount: 100, label: '+100 Dominio cura', roles: ['heal'] },
  { key: 'mastDist', amount: 100, label: '+100 Dominio distancia' },
  { key: 'mastMelee', amount: 100, label: '+100 Dominio de melé' },
  { key: 'mastCrit', amount: 100, label: '+100 Dominio crítico' },
  { key: 'mastBack', amount: 100, label: '+100 Dominio espalda', roles: ['melee', 'dist'] },
  { key: 'mastBerserk', amount: 100, label: '+100 Dominio berserker', roles: ['melee', 'dist'] },
  { key: 'crit', amount: 10, label: '+10 % Golpe crítico' },
  { key: 'dmgPct', amount: 10, label: '+10 % Daños infligidos', roles: ['melee', 'dist', 'tank'] },
  { key: 'healPct', amount: 10, label: '+10 % Curas realizadas', roles: ['heal'] },
  { key: 'ap', amount: 1, label: '+1 PA' },
  { key: 'mp', amount: 1, label: '+1 PM' },
  { key: 'range', amount: 1, label: '+1 Alcance', roles: ['dist', 'heal'] },
  { key: 'hp', amount: 500, label: '+500 PdV' },
  { key: 'resElem', amount: 100, label: '+100 Resistencia elemental' },
  { key: 'block', amount: 10, label: '+10 % Anticipación', roles: ['tank'] },
];

export interface StatValue {
  probe: StatProbe;
  output: number;      // % de cambio en daño (o cura, si el rol es curas)
  damage: number;      // % de cambio en daño (útil para comparar en curas)
  ehp: number;         // % de cambio en PdV efectivos
  overall: number;     // % de cambio en la valoración global de la build
  equivalent: number;  // dominio elemental que aporta lo mismo a la valoración
}

const pctChange = (a: number, b: number) => (a / b - 1) * 100;

export function statValues(slots: BuildSlots, req: BuildRequest, extra: Record<string, number> = {}): StatValue[] {
  const damageReq: BuildRequest = { ...req, role: req.role === 'heal' ? 'dist' : req.role };
  const base = evaluateBuild(slots, req, extra);
  const baseDamage = evaluateBuild(slots, damageReq, extra);
  const withExtra = (key: string, amount: number) => ({ ...extra, [key]: (extra[key] ?? 0) + amount });

  const rows = PROBES.filter((p) => !p.roles || p.roles.includes(req.role)).map((probe) => {
    const r = evaluateBuild(slots, req, withExtra(probe.key, probe.amount));
    const d = evaluateBuild(slots, damageReq, withExtra(probe.key, probe.amount));
    return {
      probe,
      output: pctChange(r.derived.output, base.derived.output),
      damage: pctChange(d.derived.output, baseDamage.derived.output),
      ehp: pctChange(r.derived.ehp, base.derived.ehp),
      overall: (Math.exp(r.score - base.score) - 1) * 100,
      equivalent: 0,
    };
  });
  // La valoración es logarítmica: +100 dominio elemental sirve de vara de medir.
  const ref = rows.find((r) => r.probe.key === 'mastElem')!;
  for (const r of rows) r.equivalent = ref.overall > 0 ? (r.overall / ref.overall) * 100 : 0;
  return rows.sort((a, b) => b.overall - a.overall);
}
