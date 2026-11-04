import { useMemo } from 'react';
import type { BuildRequest, BuildSlots } from './lib/optimizer';
import { statValues } from './lib/statValue';
import { STAT_LABELS } from './lib/game';
import { pct, t } from './lib/i18n';

const tone = (n: number) => (n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'muted');

export default function StatValuePanel({ slots, request, extra }: {
  slots: BuildSlots; request: BuildRequest; extra: Record<string, number>;
}) {
  const heal = request.role === 'heal';
  const reqKey = JSON.stringify({ ...request, excluded: [...request.excluded], locked: undefined });
  const rows = useMemo(
    () => statValues(slots, request, extra),
    // request se recrea en cada render; reqKey resume sus campos.
    [slots, extra, reqKey],
  );
  const max = Math.max(...rows.map((r) => r.overall), 0.01);

  return (
    <div className="panel">
      <h2>{t('value.title')}</h2>
      <p className="muted small">{t('value.intro')}</p>
      <div className="value-table">
        <div className="value-row head">
          <span>{t('value.stat')}</span>
          <span>{heal ? t('value.heals') : t('value.damage')}</span>
          {heal && <span>{t('value.damage')}</span>}
          <span>{t('picker.ehp')}</span>
          <span>{t('value.overall')}</span>
          <span>{t('value.equivalent')}</span>
        </div>
        {rows.map((r) => (
          <div key={r.probe.key} className={`value-row ${heal ? 'heal' : ''}`}>
            <span>+{r.probe.amount} {STAT_LABELS[r.probe.key]}</span>
            <span className={tone(r.output)}>{pct(r.output)}</span>
            {heal && <span className={tone(r.damage)}>{pct(r.damage)}</span>}
            <span className={tone(r.ehp)}>{pct(r.ehp)}</span>
            <span className="bar-cell">
              <span className="bar" style={{ width: `${Math.max(0, (r.overall / max) * 100)}%` }} />
              <b className={tone(r.overall)}>{pct(r.overall)}</b>
            </span>
            <span className="muted">{r.overall > 0 ? t('value.equivalentValue', { n: Math.round(r.equivalent) }) : '—'}</span>
          </div>
        ))}
      </div>
      {heal && (
        <p className="muted small">{t('value.healNote')}</p>
      )}
    </div>
  );
}
