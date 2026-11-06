import { cellText } from './SimMap';
import { fmt, t } from './lib/i18n';
import type { ActorId, StepResult, StepRow } from './lib/sim/engine';
import { CONC_KEY, PREPARATION } from './lib/sim/rules/iop';

/** Nombre del paso: hechizo, movimiento, fin de turno o ajuste. */
function stepLabel(r: StepResult, spellName: (id: number, actor: ActorId) => string | undefined): string {
  const s = r.step;
  if (s.type === 'cast') return spellName(s.spell, s.actor) ?? t('sim.step.unknown');
  if (s.type === 'move') return t('sim.step.move', { cell: cellText(s.to) });
  if (s.type === 'endTurn') return t('sim.step.endTurn');
  const parts: string[] = [];
  if (s.hpPct !== undefined) parts.push(t('sim.step.hp', { pct: Math.round(s.hpPct) }));
  if (s.armor !== undefined) parts.push(t('sim.step.armor', { n: fmt(s.armor) }));
  if (s.wp !== undefined) parts.push(t('sim.step.wp', { n: fmt(s.wp) }));
  if (s.facing) parts.push(t('sim.step.facing', { facing: t(`sim.facing.${s.facing}`) }));
  if (s.state) {
    const name = s.state.id === CONC_KEY ? t('sim.state.conc') : s.state.id === PREPARATION ? t('sim.state.prep') : s.state.id;
    parts.push(t('sim.step.state', { state: name, n: fmt(s.state.levels) }));
  }
  return parts.join(' · ');
}

/** Nombres para indicar quién actúa y sobre quién; solo se pasan cuando hay aliado. */
export interface StepNames { main: string; ally: string; mob: string }

/** "Quién → a quién" en los hechizos; solo "quién" en los movimientos y ajustes. */
function stepWho(r: StepResult, names: StepNames): string {
  const s = r.step;
  if (s.type === 'endTurn') return '';
  if (s.type === 'adjust' && !s.actor) return '';  // el giro del objetivo no es de ningún personaje
  const who: ActorId = s.type === 'adjust' ? s.actor ?? 'main' : s.actor;
  if (s.type !== 'cast') return names[who];
  const to = s.target === 'mob' ? names.mob : s.target === 'self' ? names[who] : names[who === 'main' ? 'ally' : 'main'];
  return `${names[who]} → ${to}`;
}

/** Si la cura o la armadura se limitó (a los PV que faltan o al tope), se enseña también el valor bruto. */
const capped = (row: StepRow) =>
  !!row.raw && (row.raw.normal !== row.value.normal || row.raw.crit !== row.value.crit || row.raw.avg !== row.value.avg);

function Why({ row }: { row: StepRow }) {
  return (
    <>
      {row.tags.map((k) => <span key={k} className={`tag ${k === 'sim.tag.unconfirmed' ? 'unconfirmed' : ''}`}>{t(k, row.tagVars)}</span>)}
      {row.warnings.map((k) => <span key={k} className="sim-warn">{t(k)}</span>)}
    </>
  );
}

/** Tabla de pasos: un bloque por paso, con una fila por efecto. Los pasos no válidos se quedan marcados. */
export default function SimSteps({ steps, selected, spellName, names, onSelect, onRemove }: {
  steps: StepResult[]; selected: number; spellName: (id: number, actor: ActorId) => string | undefined; names?: StepNames;
  onSelect: (i: number) => void; onRemove: (i: number) => void;
}) {
  if (steps.length === 0) return <p className="muted">{t('sim.steps.empty')}</p>;

  return (
    <div className="sim-table-wrap">
      <table className="sim-table" aria-label={t('sim.steps')}>
        <thead>
          <tr>
            <th scope="col">{t('sim.col.n')}</th><th scope="col">{t('sim.col.step')}</th>
            <th scope="col">{t('sim.col.hit')}</th><th scope="col">{t('sim.col.why')}</th>
            <th scope="col" className="num">{t('sim.col.normal')}</th>
            <th scope="col" className="num">{t('sim.col.crit')}</th>
            <th scope="col" className="num">{t('sim.col.avg')}</th>
            <th scope="col"><span className="sr-only">{t('common.remove')}</span></th>
          </tr>
        </thead>
        {steps.map((r, i) => {
          const name = stepLabel(r, spellName);
          const who = names ? stepWho(r, names) : '';
          const rows: (StepRow | null)[] = r.ok && r.rows.length ? r.rows : [null];
          return (
            <tbody key={i} className={`${i === selected ? 'sel' : ''} ${r.ok ? '' : 'invalid'}`}>
              {rows.map((row, j) => (
                <tr key={j}>
                  {j === 0 && (
                    <>
                      <td rowSpan={rows.length}>{i + 1}</td>
                      <td rowSpan={rows.length}>
                        <button type="button" className="sim-step-btn" aria-pressed={i === selected}
                          title={t('sim.step.select', { n: i + 1 })} onClick={() => onSelect(i)}>{name}</button>
                        {who && <small className="muted sim-who">{who}</small>}
                      </td>
                    </>
                  )}
                  {!r.ok ? (
                    <td colSpan={5}>
                      <span className="tag neg">{t('sim.invalid')}</span> <span className="sim-warn">{r.reason ? t(r.reason) : ''}</span>
                    </td>
                  ) : row === null ? (
                    <td colSpan={5} className="muted">{r.step.type === 'cast' ? t('sim.row.noEffect') : ''}</td>
                  ) : (
                    <>
                      <td>{row.kind === 'damage' ? (row.position ? t(`sim.pos.${row.position}`) : '') : t(`sim.kind.${row.kind}`)}</td>
                      <td className="sim-why"><Why row={row} /></td>
                      {row.uncalculated ? (
                        <td colSpan={3} className="num muted">{t('sim.row.uncalculated')}</td>
                      ) : (
                        <>
                          <td className="num">{fmt(row.value.normal)}</td>
                          <td className="num">{fmt(row.value.crit)}</td>
                          <td className="num"><b>{fmt(row.value.avg)}</b>
                            {row.raw && capped(row) && <small className="muted"> ({t('sim.row.raw', { n: fmt(row.raw.avg) })})</small>}
                          </td>
                        </>
                      )}
                    </>
                  )}
                  {j === 0 && (
                    <td rowSpan={rows.length}>
                      <button type="button" className="x" aria-label={t('sim.remove', { n: i + 1 })}
                        title={t('sim.remove', { n: i + 1 })} onClick={() => onRemove(i)}>×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
