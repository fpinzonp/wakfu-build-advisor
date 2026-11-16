// Listas de la receta (materias primas, planos, crafteos intermedios) con un check para ir marcando lo que ya se tiene.
// Se guarda la cantidad que había cuando se marcó: si luego hace falta más, vuelve a quedar pendiente.
import { useState, type ReactNode } from 'react';
import { itemImage } from './lib/game';
import { locale, t } from './lib/i18n';

const fmt = (n: number) => n.toLocaleString(locale());

export const GATHERED_KEYS = { materials: 'wba.matGathered', plans: 'wba.planGathered', crafts: 'wba.craftDone' } as const;

function load(key: string): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}; } catch { return {}; }
}
function save(key: string, o: Record<number, number>) {
  try { localStorage.setItem(key, JSON.stringify(o)); } catch { /* sin almacenamiento local */ }
}

export interface Gathered {
  isGathered: (m: { id: number; qty: number }) => boolean;
  toggle: (m: { id: number; qty: number }, on: boolean) => void;
}

/** Elementos marcados (id -> cantidad marcada), guardados en este navegador bajo `key`. */
export function useGathered(key: string): Gathered {
  const [gathered, setGathered] = useState<Record<number, number>>(() => load(key));
  const isGathered = (m: { id: number; qty: number }) => (gathered[m.id] ?? 0) >= m.qty;
  const toggle = (m: { id: number; qty: number }, on: boolean) => setGathered((cur) => {
    const next = { ...cur };
    if (on) next[m.id] = m.qty; else delete next[m.id];
    save(key, next);
    return next;
  });
  return { isGathered, toggle };
}

/** Fila con check: tachada y atenuada cuando está marcada. */
export function CheckRow({ on, onChange, label, className, children }: {
  on: boolean; onChange: (on: boolean) => void; label: string; className?: string; children: ReactNode;
}) {
  return (
    <li className={[className, on ? 'done' : ''].filter(Boolean).join(' ')}>
      <label className="mat-check">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        {children}
      </label>
    </li>
  );
}

interface Props {
  materials: { id: number; qty: number }[];
  name: (id: number) => string;
  gfx: (id: number) => number;
  extra?: (id: number) => ReactNode;
  gathered: Gathered;
}

export default function GatheredList({ materials, name, gfx, extra, gathered }: Props) {
  const done = materials.filter(gathered.isGathered).length;
  return (
    <>
      <p className="small muted" role="status">{t('mat.gatheredLeft', { n: materials.length - done, total: materials.length })}</p>
      <ul className="mat-list">
        {materials.map((m) => (
          <CheckRow key={m.id} on={gathered.isGathered(m)} onChange={(on) => gathered.toggle(m, on)}
            label={t('mat.gathered', { name: name(m.id) })}>
            <img src={itemImage(gfx(m.id))} alt="" loading="lazy" referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
            <span className="qty">{fmt(m.qty)}×</span>
            <span className="mat-name">{name(m.id)}{extra?.(m.id)}</span>
          </CheckRow>
        ))}
      </ul>
    </>
  );
}
