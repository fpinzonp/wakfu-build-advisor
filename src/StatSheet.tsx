import { ELEMENTS, STAT_LABELS, type Element } from './lib/game';
import { buildSheet } from './lib/characteristics';
import type { BuildResult } from './lib/optimizer';
import { fmt, t, type TKey } from './lib/i18n';


type Row = [label: TKey, key: string, suffix?: string];

const GENERAL: Row[] = [['stat.hp', 'hp'], ['stat.ap', 'ap'], ['stat.mp', 'mp'], ['stat.wp', 'wp']];
const ARMOR: Row[] = [['sheet.armorReceived', 'armorReceived', '%'], ['sheet.armorGiven', 'armorGiven', '%']];
const SECONDARY: Row[] = [
  ['sheet.dmgPct', 'dmgPct', '%'], ['sheet.healPct', 'healPct', '%'],
  ['sheet.crit', 'crit', '%'],
  ['sheet.block', 'block', '%'],
  ['stat.init', 'init'], ['stat.range', 'range'],
  ['stat.dodge', 'dodge'], ['stat.tackle', 'tackle'],
  ['stat.wisdom', 'wisdom'], ['stat.prospection', 'prospection'],
  ['stat.control', 'control'], ['stat.will', 'will'],
];
const MASTERIES: Row[] = [
  ['stat.mastCrit', 'mastCrit'], ['stat.resCrit', 'resCrit'],
  ['stat.mastBack', 'mastBack'], ['stat.resBack', 'resBack'],
  ['stat.mastMelee', 'mastMelee'], ['stat.mastDist', 'mastDist'],
  ['stat.mastHeal', 'mastHeal'], ['stat.mastBerserk', 'mastBerserk'],
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
            <span>{t(label)}</span>
            <b className={v < 0 ? 'neg' : ''}>{fmt(v)}{suffix}</b>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="panel sheet">
      <div className="panel-head">
        <h2>{t('tab.stats')}</h2>
        <label className="check">
          <input type="checkbox" checked={withRunes} disabled={!runesAvailable} onChange={(e) => onToggleRunes(e.target.checked)} />
          <span>{t('sheet.withRunes')}{!runesAvailable && <small className="muted">{t('sheet.withRunes.hint')}</small>}</span>
        </label>
      </div>
      {withRunes && runeBonus && (
        <div className="row wrap">
          {Object.entries(runeBonus).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className={`tag ${v < 0 ? 'neg' : ''}`}>{v > 0 ? '+' : ''}{fmt(v)} {STAT_LABELS[k] ?? k}</span>
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
              <span className="el-val" title={t('sheet.mastery')}>{fmt(l.mastery)}</span>
              <span className="el-res" title={t('sheet.resistance')}>
                <small>({Math.floor(l.resPct)} %)</small> {fmt(l.res)}
              </span>
            </div>
          );
        })}
        <div className="sheet-cell wide">
          <span>{t('sheet.roleMastery')}</span>
          <b>{fmt(result.derived.mastery)}</b>
        </div>
      </div>

      {grid(SECONDARY)}
      {grid(MASTERIES)}

      <p className="muted small">{t('sheet.note')}</p>
    </div>
  );
}
