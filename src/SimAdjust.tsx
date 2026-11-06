import { useState } from 'react';
import { t } from './lib/i18n';
import type { ActorId, SimStep } from './lib/sim/engine';
import type { Facing } from './lib/sim/formulas';
import { CONC_KEY, PREPARATION } from './lib/sim/rules/iop';

const FACINGS: Facing[] = ['n', 'e', 's', 'w'];

function Adjust({ label, value, onChange, onApply, applyLabel, max, hint }: {
  label: string; value: number; onChange: (n: number) => void; onApply: () => void; applyLabel: string; max?: number; hint?: string;
}) {
  return (
    <div className="sim-adjust-item">
      <label className="field sim-num">
        <span className="label">{label}</span>
        <input className="input" type="number" min={0} max={max} value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(max ?? Infinity, Number(e.target.value) || 0)))} />
        {hint && <small className="muted">{hint}</small>}
      </label>
      <button type="button" className="btn" onClick={onApply}>{applyLabel}</button>
    </div>
  );
}

/** El giro es del objetivo, no de un personaje: no lleva `actor` y sobrevive a quitar el aliado. */
export const facingStep = (facing: Facing): SimStep => ({ type: 'adjust', facing });

/** Ajustes manuales que se añaden como pasos: PV, armadura, giro del objetivo y, en Yopuka, Concentración y Preparación.
 * PV, armadura y estados son del personaje que actúa (`actor`). */
export default function SimAdjust({ actor, yopuka, comboExtraPct, onComboExtra, onAdd }: {
  actor: ActorId; yopuka: boolean; comboExtraPct: number; onComboExtra: (n: number) => void; onAdd: (s: SimStep) => void;
}) {
  const [hpPct, setHpPct] = useState(100);
  const [armor, setArmor] = useState(0);
  const [wp, setWp] = useState(0);
  const [conc, setConc] = useState(0);
  const [prep, setPrep] = useState(0);
  const adjust = (patch: Partial<Extract<SimStep, { type: 'adjust' }>>): SimStep => ({ type: 'adjust', actor, ...patch });

  return (
    <div className="sim-adjust">
      <Adjust label={t('sim.hpPct')} value={hpPct} max={100} onChange={setHpPct} applyLabel={t('sim.hpApply')}
        onApply={() => onAdd(adjust({ hpPct }))} />
      <Adjust label={t('sim.armorSet')} value={armor} onChange={setArmor} applyLabel={t('sim.armorApply')}
        onApply={() => onAdd(adjust({ armor }))} />
      <Adjust label={t('sim.wpSet')} value={wp} onChange={setWp} applyLabel={t('sim.wpApply')}
        onApply={() => onAdd(adjust({ wp }))} />
      <div className="field">
        <span className="label" id="sim-turn-target">{t('sim.turnTarget')}</span>
        <div className="seg" role="group" aria-labelledby="sim-turn-target">
          {FACINGS.map((f) => (
            <button key={f} type="button" title={t('sim.turnTarget.aria')} onClick={() => onAdd(facingStep(f))}>
              {t(`sim.facing.${f}`)}
            </button>
          ))}
        </div>
      </div>
      {yopuka && (
        <>
          <Adjust label={t('sim.state.conc')} value={conc} onChange={setConc} applyLabel={t('sim.state.apply')}
            onApply={() => onAdd(adjust({ state: { id: CONC_KEY, levels: conc } }))} />
          <Adjust label={t('sim.state.prep')} value={prep} onChange={setPrep} applyLabel={t('sim.state.apply')}
            onApply={() => onAdd(adjust({ state: { id: PREPARATION, levels: prep } }))} />
          <label className="field sim-num">
            <span className="label">{t('sim.comboExtra')}</span>
            <input className="input" type="number" min={0} value={comboExtraPct}
              onChange={(e) => onComboExtra(Math.max(0, Number(e.target.value) || 0))} />
            <small className="muted">{t('sim.comboExtra.hint')}</small>
          </label>
        </>
      )}
    </div>
  );
}
