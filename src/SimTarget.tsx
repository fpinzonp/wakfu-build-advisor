import { useMemo, useState } from 'react';
import { ELEMENTS, type Element } from './lib/game';
import { t } from './lib/i18n';
import type { Facing } from './lib/sim/formulas';
import { mobAtLevel, type Mob } from './lib/sim/mobs';

/** Objetivo editable: los valores salen del mob y del nivel, y se pueden retocar a mano. */
export interface TargetState {
  mob: Mob | null; level: number; hp: number; res: Record<Element, number>; resBack: number; resCrit: number;
}

export const DUMMY: TargetState = {
  mob: null, level: 1, hp: 100000, res: { fire: 0, water: 0, earth: 0, air: 0 }, resBack: 0, resCrit: 0,
};

/** Objetivo de un mob a un nivel; la resistencia de espalda y la crítica empiezan en 0 (la wiki no las da). */
export function targetOf(mob: Mob, level: number): TargetState {
  const s = mobAtLevel(mob, level);
  return { mob, level, hp: s.hp, res: s.res, resBack: 0, resCrit: 0 };
}

const MAX_SHOWN = 50;
const FACINGS: Facing[] = ['n', 'e', 's', 'w'];
const FACING_ARROW: Record<Facing, string> = { n: '▲', e: '▶', s: '▼', w: '◀' };

type Load = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; mobs: Mob[] };

function NumberField({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (n: number) => void; hint?: string;
}) {
  return (
    <label className="field sim-num">
      <span className="label">{label}</span>
      <input className="input" type="number" inputMode="numeric" value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export default function SimTarget({ load, target, facing, onTarget, onFacing, onRetry }: {
  load: Load; target: TargetState; facing: Facing;
  onTarget: (s: TargetState) => void; onFacing: (f: Facing) => void; onRetry: () => void;
}) {
  const [query, setQuery] = useState('');
  const mobs = load.status === 'ready' ? load.mobs : null;

  // Texto en minúsculas de cada mob, calculado una vez: con 1340 entradas filtrar en cada tecla es instantáneo.
  const index = useMemo(() => (mobs ?? []).map((m) => `${m.name} ${m.family}`.toLowerCase()), [mobs]);
  const { shown, total } = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out: Mob[] = [];
    let n = 0;
    (mobs ?? []).forEach((m, i) => {
      if (!words.every((w) => index[i].includes(w))) return;
      n++;
      if (out.length < MAX_SHOWN) out.push(m);
    });
    return { shown: out, total: n };
  }, [mobs, index, query]);

  const set = (patch: Partial<TargetState>) => onTarget({ ...target, ...patch });

  return (
    <div className="panel sim-target">
      <h2>{t('sim.target')}</h2>
      <p className="sim-current"><b>{target.mob ? target.mob.name : t('sim.dummy')}</b>
        {target.mob && <> <button type="button" className="link" onClick={() => onTarget(DUMMY)}>{t('sim.mob.clear')}</button></>}
      </p>

      {load.status === 'loading' || load.status === 'idle' ? <p className="muted" role="status">{t('sim.mob.loading')}</p>
        : load.status === 'error' ? (
          <div className="sim-error" role="alert">
            <p className="error">{t('sim.mob.loadError')}</p>
            <button type="button" className="btn" onClick={onRetry}>{t('sim.mob.retry')}</button>
          </div>
        ) : (
          <>
            <label className="field">
              <span className="label">{t('sim.mob.search')}</span>
              <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {shown.length === 0 ? <p className="muted small" role="status">{t('sim.mob.none')}</p> : (
              <ul className="sim-mobs" aria-label={t('sim.mob.list')}>
                {shown.map((m) => (
                  <li key={`${m.name}|${m.family}|${m.minLevel}`}>
                    <button type="button" aria-pressed={target.mob === m} onClick={() => onTarget(targetOf(m, m.minLevel))}>
                      {t('sim.mob.option', { name: m.name, family: m.family, min: m.minLevel, max: m.maxLevel })}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {total > shown.length && <p className="muted small" role="status">{t('sim.mob.more', { n: MAX_SHOWN })}</p>}
          </>
        )}

      <div className="sim-fields">
        {target.mob && (
          <NumberField label={t('sim.target.level')} value={target.level} hint={t('sim.target.levelHint')}
            onChange={(n) => onTarget(targetOf(target.mob!, Math.max(1, n)))} />
        )}
        <NumberField label={t('sim.target.hp')} value={target.hp} onChange={(n) => set({ hp: Math.max(1, n) })} />
        {ELEMENTS.map((e) => (
          <NumberField key={e.id} label={t('sim.target.res', { el: e.label })} value={target.res[e.id]}
            onChange={(n) => set({ res: { ...target.res, [e.id]: n } })} />
        ))}
        <NumberField label={t('sim.target.resBack')} value={target.resBack} onChange={(n) => set({ resBack: n })} />
        <NumberField label={t('sim.target.resCrit')} value={target.resCrit} onChange={(n) => set({ resCrit: n })} />
      </div>

      <div className="field">
        <span className="label" id="sim-facing">{t('sim.target.facing')}</span>
        <div className="seg" role="group" aria-labelledby="sim-facing">
          {FACINGS.map((f) => (
            <button key={f} type="button" className={facing === f ? 'on' : ''} aria-pressed={facing === f} onClick={() => onFacing(f)}>
              <span aria-hidden="true">{FACING_ARROW[f]}</span> {t(`sim.facing.${f}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { Load as MobLoad };
