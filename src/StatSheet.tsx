import { ELEMENTS, STAT_LABELS, type Element } from './lib/game';
import { buildSheet } from './lib/characteristics';
import type { BuildResult } from './lib/optimizer';

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');

type Row = [label: string, key: string, suffix?: string];

const GENERAL: Row[] = [['PdV', 'hp'], ['PA', 'ap'], ['PM', 'mp'], ['PW', 'wp']];
const ARMOR: Row[] = [['Armadura recibida', 'armorReceived', '%'], ['Armadura dada', 'armorGiven', '%']];
const SECONDARY: Row[] = [
  ['Daños infligidos', 'dmgPct', '%'], ['Curas realizadas', 'healPct', '%'],
  ['Golpe crítico', 'crit', '%'],
  ['Anticipación', 'block', '%'],
  ['Iniciativa', 'init'], ['Alcance', 'range'],
  ['Esquiva', 'dodge'], ['Placaje', 'tackle'],
  ['Sabiduría', 'wisdom'], ['Prospección', 'prospection'],
  ['Control', 'control'], ['Voluntad', 'will'],
];
const MASTERIES: Row[] = [
  ['Dominio crítico', 'mastCrit'], ['Resistencia crítica', 'resCrit'],
  ['Dominio espalda', 'mastBack'], ['Resistencia espalda', 'resBack'],
  ['Dominio de melé', 'mastMelee'], ['Dominio distancia', 'mastDist'],
  ['Dominio cura', 'mastHeal'], ['Dominio berserker', 'mastBerserk'],
];

export default function StatSheet({ result, elements, withRunes, runesAvailable, onToggleRunes, runeBonus }: {
  result: BuildResult; elements: Element[];
  withRunes: boolean; runesAvailable: boolean; onToggleRunes: (v: boolean) => void;
  runeBonus?: Record<string, number> | null;
}) {
  const sheet = buildSheet(result, elements);
  const value = (key: string) => (key === 'hp' ? result.derived.hp : sheet.stats[key] ?? 0);

  const grid = (rows: Row[]) => (
    <div className="sheet-grid">
      {rows.map(([label, key, suffix]) => {
        const v = value(key);
        return (
          <div key={key} className="sheet-cell">
            <span>{label}</span>
            <b className={v < 0 ? 'neg' : ''}>{fmt(v)}{suffix}</b>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="panel sheet">
      <div className="panel-head">
        <h2>Características</h2>
        <label className="check">
          <input type="checkbox" checked={withRunes} disabled={!runesAvailable} onChange={(e) => onToggleRunes(e.target.checked)} />
          <span>Incluir mis runas{!runesAvailable && <small className="muted">Elige runas en "Runas y sublimaciones"</small>}</span>
        </label>
      </div>
      {withRunes && runeBonus && (
        <div className="row wrap">
          {Object.entries(runeBonus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className="tag">+{fmt(v)} {STAT_LABELS[k] ?? k}</span>
          ))}
        </div>
      )}

      {grid(GENERAL)}
      {grid(ARMOR)}

      <div className="sheet-elements">
        {sheet.elements.map((l) => {
          const info = ELEMENTS.find((e) => e.id === l.element)!;
          const used = elements.includes(l.element);
          return (
            <div key={l.element} className={`sheet-el ${used ? '' : 'unused'}`} style={{ '--el': info.color } as React.CSSProperties}>
              <span className="el-name">{info.label}</span>
              <span className="el-val" title="Dominio">{fmt(l.mastery)}</span>
              <span className="el-res" title="Resistencia (reducción de daño)">
                <small>({Math.floor(l.resPct)} %)</small> {fmt(l.res)}
              </span>
            </div>
          );
        })}
        <div className="sheet-cell wide">
          <span>Dominio efectivo del rol</span>
          <b>{fmt(result.derived.mastery)}</b>
        </div>
      </div>

      {grid(SECONDARY)}
      {grid(MASTERIES)}

      <p className="muted small">Dominio y resistencia por elemento: cada columna muestra dominio, luego (% de reducción)
        y resistencia. El "dominio en N elementos" aleatorio se asigna a tus elementos y las resistencias aleatorias a los
        elementos con menos resistencia. No incluye pasivas de clase, sublimaciones ni bonificaciones de combate.</p>
    </div>
  );
}
