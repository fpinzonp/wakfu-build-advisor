import { useMemo } from 'react';
import type { BuildRequest, BuildSlots } from './lib/optimizer';
import { statValues } from './lib/statValue';

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;
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
      <h2>Valor de cada característica</h2>
      <p className="muted small">Cuánto mejoraría <b>esta build</b> si ganaras cada característica. "Equivale a" traduce
        la mejora global a dominio elemental: sirve para comparar piezas (por ejemplo, 100 de dominio cura frente a 100 de
        distancia). Los valores cambian según lo que ya tienes: un PA más vale poco si ya alcanzaste tu objetivo.</p>
      <div className="value-table">
        <div className="value-row head">
          <span>Característica</span>
          <span>{heal ? 'Curas' : 'Daño'}</span>
          {heal && <span>Daño</span>}
          <span>PdV ef.</span>
          <span>Global</span>
          <span>Equivale a</span>
        </div>
        {rows.map((r) => (
          <div key={r.probe.key} className={`value-row ${heal ? 'heal' : ''}`}>
            <span>{r.probe.label}</span>
            <span className={tone(r.output)}>{pct(r.output)}</span>
            {heal && <span className={tone(r.damage)}>{pct(r.damage)}</span>}
            <span className={tone(r.ehp)}>{pct(r.ehp)}</span>
            <span className="bar-cell">
              <span className="bar" style={{ width: `${Math.max(0, (r.overall / max) * 100)}%` }} />
              <b className={tone(r.overall)}>{pct(r.overall)}</b>
            </span>
            <span className="muted">{r.overall > 0 ? `${Math.round(r.equivalent)} dom. elem.` : '—'}</span>
          </div>
        ))}
      </div>
      {heal && (
        <p className="muted small">Curas: suman dominio elemental, dominio cura y dominio distancia (se asume que curas a 3+
          casillas; a 1-2 casillas cuenta el de melé). "% daños infligidos" y dominio espalda no afectan a las curas. La
          columna Daño muestra lo que ganarías al atacar con esos mismos hechizos.</p>
      )}
    </div>
  );
}
