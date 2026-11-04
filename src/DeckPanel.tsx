import { useMemo, useState } from 'react';
import { STAT_LABELS } from './lib/game';
import {
  ACTIVE_SLOTS, SPELL_GROUPS, passiveSlots, spellImage, spellStats,
  type Deck, type DeckBonus, type Spell,
} from './lib/spells';

const PASSIVE_UNLOCK = [10, 30, 50, 100, 150, 200];
const PCT_KEYS = new Set(['hpPct', 'dmgPct', 'healPct', 'armorGiven', 'armorReceived', 'crit', 'block']);

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
const statLine = (k: string, v: number) => {
  const label = (STAT_LABELS[k] ?? k).replace(/^% /, '');
  return `${v > 0 ? '+' : ''}${fmt(v)}${PCT_KEYS.has(k) ? '%' : ''} ${label}`;
};
const zeroLine = (k: string) => `${(STAT_LABELS[k] ?? k).replace(/^% /, '')} a 0`;

export default function DeckPanel({ spells, deck, level, bonus, onChange, onShare }: {
  spells: Spell[] | null; deck: Deck; level: number; bonus: DeckBonus;
  onChange: (d: Deck) => void; onShare: () => void;
}) {
  const [focus, setFocus] = useState<Spell | null>(null);
  const byId = useMemo(() => new Map((spells ?? []).map((s) => [s.id, s])), [spells]);

  if (!spells) return <div className="panel muted">Cargando hechizos…</div>;
  if (!spells.length) {
    return <div className="panel muted">No hay datos de hechizos para esta clase. Ejecuta <code>npm run data</code> para descargarlos.</div>;
  }

  const maxPassives = passiveSlots(level);
  const inDeck = new Set([...deck.actives, ...deck.passives]);
  const passives = spells.filter((s) => s.el === 'passive');
  const groups = SPELL_GROUPS
    .map((g) => ({ ...g, spells: spells.filter((s) => s.el === g.el) }))
    .filter((g) => g.spells.length);

  const toggle = (s: Spell) => {
    setFocus(s);
    const key = s.el === 'passive' ? 'passives' : 'actives';
    const list = deck[key];
    if (list.includes(s.id)) return onChange({ ...deck, [key]: list.filter((id) => id !== s.id) });
    const cap = key === 'passives' ? maxPassives : ACTIVE_SLOTS;
    if (s.lvl > level || list.length >= cap) return;
    onChange({ ...deck, [key]: [...list, s.id] });
  };

  const full = (s: Spell) => (s.el === 'passive' ? deck.passives.length >= maxPassives : deck.actives.length >= ACTIVE_SLOTS);

  const icon = (s: Spell) => {
    const selected = inDeck.has(s.id);
    const locked = s.lvl > level;
    const blocked = !selected && (locked || full(s));
    const impact = !!(s.stats || s.zero);
    return (
      <button key={s.id} type="button"
        className={`spell ${selected ? 'on' : ''} ${locked ? 'locked' : ''} ${impact ? 'impact' : ''}`}
        aria-pressed={selected} aria-disabled={blocked}
        title={`${s.name}${s.lvl ? ` · nv. ${s.lvl}` : ''}${locked ? ' (nivel insuficiente)' : ''}`}
        onClick={() => (blocked ? setFocus(s) : toggle(s))}
        onMouseEnter={() => setFocus(s)} onFocus={() => setFocus(s)}>
        <img src={spellImage(s.icon)} alt={s.name} loading="lazy" referrerPolicy="no-referrer" />
        {locked && <span className="spell-lvl">{s.lvl}</span>}
        {impact && <span className="spell-dot" aria-hidden="true" />}
      </button>
    );
  };

  const slot = (id: number | undefined, key: string, lockedAt?: number) => {
    const s = id !== undefined ? byId.get(id) : undefined;
    if (lockedAt !== undefined) {
      return <div key={key} className="deck-slot is-locked" title={`Se desbloquea al nivel ${lockedAt}`}>nv. {lockedAt}</div>;
    }
    if (!s) return <div key={key} className="deck-slot" aria-label="Ranura vacía" />;
    return (
      <button key={key} type="button" className={`deck-slot filled ${s.lvl > level ? 'over' : ''}`}
        title={`Quitar ${s.name}`} onClick={() => toggle(s)}
        onMouseEnter={() => setFocus(s)} onFocus={() => setFocus(s)}>
        <img src={spellImage(s.icon)} alt={s.name} referrerPolicy="no-referrer" />
      </button>
    );
  };

  const impactLines = [
    ...Object.entries(bonus.stats).filter(([, v]) => v).map(([k, v]) => ({ k, text: statLine(k, v), neg: v < 0 })),
    ...bonus.zero.map((k) => ({ k: `zero-${k}`, text: zeroLine(k), neg: true })),
  ];
  const focusStats = focus ? Object.entries(spellStats(focus, level)).filter(([, v]) => v) : [];

  return (
    <div className="deck-layout">
      <div className="panel deck-pool">
        <h2>Hechizos</h2>
        {groups.map((g) => (
          <section key={g.el} className="spell-group">
            <h3 style={{ color: g.color }}>{g.label}</h3>
            <div className="spell-grid">{g.spells.map(icon)}</div>
          </section>
        ))}
        <section className="spell-group">
          <h3>Pasivas <small>· el punto indica efecto en características</small></h3>
          <div className="spell-grid">{passives.map(icon)}</div>
        </section>
      </div>

      <div className="deck-side">
        <div className="panel">
          <div className="panel-head">
            <h2>Baraja</h2>
            <div className="actions">
              <button className="btn ghost" disabled={!inDeck.size} onClick={() => onChange({ actives: [], passives: [] })}>
                Vaciar baraja
              </button>
              <button className="btn" onClick={onShare}>Compartir build</button>
            </div>
          </div>
          <span className="eyebrow">Activos {deck.actives.length}/{ACTIVE_SLOTS}</span>
          <div className="deck-grid">
            {Array.from({ length: ACTIVE_SLOTS }, (_, i) => slot(deck.actives[i], `a${i}`))}
          </div>
          <span className="eyebrow">Pasivas {deck.passives.length}/{maxPassives}</span>
          <div className="deck-grid">
            {PASSIVE_UNLOCK.map((lvl, i) => slot(deck.passives[i], `p${i}`, level >= lvl ? undefined : lvl))}
          </div>
          <p className="muted small">La baraja va dentro del enlace y de las builds guardadas.</p>
        </div>

        <div className="panel">
          <h2>Efecto en tus características</h2>
          {impactLines.length ? (
            <>
              <div className="row wrap deck-impact">
                {impactLines.map((l) => <span key={l.k} className={`tag ${l.neg ? 'neg' : ''}`}>{l.text}</span>)}
              </div>
              <p className="muted small">Ya se suma en "Características" y el optimizador lo tiene en cuenta: pulsa "Recalcular
                build" para que elija el equipo con estas pasivas.</p>
            </>
          ) : (
            <p className="muted">Ninguna pasiva de tu baraja cambia tus características de forma permanente. Las marcadas con un
              punto sí lo hacen (p. ej. Motivación: +1 PA).</p>
          )}
        </div>

        <div className="panel spell-detail" aria-live="polite">
          {focus ? (
            <>
              <div className="spell-detail-head">
                <img src={spellImage(focus.icon)} alt="" referrerPolicy="no-referrer" />
                <div>
                  <b>{focus.name}</b>
                  <div className="muted">
                    {focus.el === 'passive' ? 'Pasiva' : SPELL_GROUPS.find((g) => g.el === focus.el)?.label ?? 'Hechizo'}
                    {focus.lvl > 0 && ` · nivel ${focus.lvl}`}
                    {focus.lvl > level && <span className="neg"> · aún no disponible</span>}
                  </div>
                </div>
              </div>
              {(focusStats.length > 0 || focus.zero) && (
                <div className="row wrap deck-impact">
                  {focusStats.map(([k, v]) => <span key={k} className={`tag ${v < 0 ? 'neg' : ''}`}>{statLine(k, v)}</span>)}
                  {focus.zero?.map((k) => <span key={k} className="tag neg">{zeroLine(k)}</span>)}
                </div>
              )}
              <ul className="spell-text" lang="en">
                {focus.text.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </>
          ) : (
            <p className="muted">Pasa el cursor o toca un hechizo para ver su efecto. Haz clic para añadirlo o quitarlo de la baraja.</p>
          )}
        </div>
      </div>
    </div>
  );
}
