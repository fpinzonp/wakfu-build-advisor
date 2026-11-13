// Monstruos que sueltan una pieza (datos de wakfu.wiki.gg), de mayor a menor probabilidad.
import type { Drop } from './lib/game';
import { locale, t } from './lib/i18n';

export default function DropList({ drops }: { drops: Drop[] }) {
  return (
    <div className="recipe drops">
      <ul>
        {drops.map((d, i) => (
          <li key={`${d.monster}-${i}`}>
            <span className="qty">{t('drops.rate', { n: d.rate.toLocaleString(locale(), { maximumFractionDigits: 2 }) })}</span>
            <span>{d.monster}</span>
            {(d.type || d.minLevel) && (
              <span className="muted">
                {[d.type, d.minLevel ? t('drops.level', { min: d.minLevel, max: d.maxLevel ?? d.minLevel }) : ''].filter(Boolean).join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
