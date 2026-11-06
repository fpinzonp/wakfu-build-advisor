import { useState } from 'react';
import { locale, t } from './lib/i18n';
import { loadStored, type StoredBuild } from './lib/share';
import type { SimActor } from './lib/sim/engine';

/** Builds guardadas para elegir aliado; sin ninguna, explica cómo guardar una. */
export function AllyList({ list, onPick }: { list: StoredBuild[]; onPick: (b: StoredBuild) => void }) {
  if (list.length === 0) {
    return (
      <div className="empty-inline">
        <p><b>{t('sim.ally.none')}</b></p>
        <p className="muted">{t('sim.ally.noneHint')}</p>
      </div>
    );
  }
  return (
    <ul className="sim-mobs" aria-label={t('sim.ally.list')}>
      {list.map((b) => (
        <li key={b.id}>
          <button type="button" onClick={() => onPick(b)}>
            <b>{b.name}</b> <span className="muted">{b.summary} · {new Date(b.date).toLocaleDateString(locale())}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Modo de apoyo: añade o quita un segundo personaje sacado de las builds guardadas.
 * `onPick` devuelve false si la build no se pudo convertir en personaje; `affected` es el número de pasos
 * que se perderían al quitarlo.
 */
export default function SimAlly({ ally, ready, affected, onPick, onRemove }: {
  ally: SimActor | null; ready: boolean; affected: number; onPick: (b: StoredBuild) => boolean; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<StoredBuild[]>([]);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const show = () => { setList(loadStored()); setFailed(false); setOpen(true); };
  const pick = (b: StoredBuild) => {
    if (onPick(b)) { setOpen(false); setFailed(false); } else setFailed(true);
  };

  return (
    <div className="panel sim-ally">
      <h2>{t('sim.ally')}</h2>
      {ally ? (
        <>
          <p className="sim-current"><b>{ally.name}</b></p>
          <p className="sim-warn" role="note">{t('sim.warn.allyNoEnchant')}</p>
          {confirming ? (
            <div className="actions">
              <p className="muted small">{t('sim.ally.removeWarn', { n: affected })}</p>
              <button type="button" className="btn danger" onClick={() => { setConfirming(false); onRemove(); }}>
                {t('sim.ally.removeNamed', { n: affected })}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
            </div>
          ) : (
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => (affected > 0 ? setConfirming(true) : onRemove())}>
                {t('sim.ally.remove')}
              </button>
            </div>
          )}
        </>
      ) : open ? (
        <>
          <AllyList list={list} onPick={pick} />
          {failed && <p className="sim-warn" role="alert">{t('sim.err.ally')}</p>}
          <div className="actions"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button></div>
        </>
      ) : (
        <>
          <p className="muted small">{t('sim.ally.hint')}</p>
          <div className="actions">
            <button type="button" className="btn" disabled={!ready} onClick={show}>{t('sim.ally.add')}</button>
          </div>
        </>
      )}
    </div>
  );
}
