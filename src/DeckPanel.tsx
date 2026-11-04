import { useMemo, useState } from 'react';
import { STAT_LABELS } from './lib/game';
import { fmt, t } from './lib/i18n';
import {
  ACTIVE_SLOTS, SPELL_GROUPS, groupLabel, passiveSlots, spellImage, spellStats,
  type Deck, type DeckBonus, type Spell,
} from './lib/spells';

const PASSIVE_UNLOCK = [10, 30, 50, 100, 150, 200];
const PCT_KEYS = new Set(['hpPct', 'dmgPct', 'healPct', 'armorGiven', 'armorReceived', 'crit', 'block']);

const statLine = (k: string, v: number) => {
  const label = (STAT_LABELS[k] ?? k).replace(/^% /, '');
  return `${v > 0 ? '+' : ''}${fmt(v)}${PCT_KEYS.has(k) ? '%' : ''} ${label}`;
};
const zeroLine = (k: string) => t('deck.zero', { stat: (STAT_LABELS[k] ?? k).replace(/^% /, '') });

export default function DeckPanel({ spells, deck, level, bonus, onChange, onShare }: {
  spells: Spell[] | null; deck: Deck; level: number; bonus: DeckBonus;
  onChange: (d: Deck) => void; onShare: () => void;
}) {
  const [focus, setFocus] = useState<Spell | null>(null);
  const byId = useMemo(() => new Map((spells ?? []).map((s) => [s.id, s])), [spells]);

  if (!spells) return <div className="panel muted">{t('deck.loading')}</div>;
  if (!spells.length) return <div className="panel muted">{t('deck.noData')}</div>;

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
        title={`${s.name}${s.lvl ? ` · ${t('common.lvlShort', { n: s.lvl })}` : ''}${locked ? ` (${t('deck.lowLevel')})` : ''}`}
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
      return <div key={key} className="deck-slot is-locked" title={t('deck.unlocksAt', { n: lockedAt })}>{t('common.lvlShort', { n: lockedAt })}</div>;
    }
    if (!s) return <div key={key} className="deck-slot" aria-label={t('deck.emptySlot')} />;
    return (
      <button key={key} type="button" className={`deck-slot filled ${s.lvl > level ? 'over' : ''}`}
        title={t('deck.removeSpell', { name: s.name })} onClick={() => toggle(s)}
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
        <h2>{t('tab.deck')}</h2>
        {groups.map((g) => (
          <section key={g.el} className="spell-group">
            <h3 style={{ color: g.color }}>{t(g.key)}</h3>
            <div className="spell-grid">{g.spells.map(icon)}</div>
          </section>
        ))}
        <section className="spell-group">
          <h3>{t('deck.passives')} <small>· {t('deck.dotHint')}</small></h3>
          <div className="spell-grid">{passives.map(icon)}</div>
        </section>
      </div>

      <div className="deck-side">
        <div className="panel">
          <div className="panel-head">
            <h2>{t('deck.title')}</h2>
            <div className="actions">
              <button className="btn ghost" disabled={!inDeck.size} onClick={() => onChange({ actives: [], passives: [] })}>
                {t('deck.clear')}
              </button>
              <button className="btn" onClick={onShare}>{t('share.title')}</button>
            </div>
          </div>
          <span className="eyebrow">{t('deck.actives')} {deck.actives.length}/{ACTIVE_SLOTS}</span>
          <div className="deck-grid">
            {Array.from({ length: ACTIVE_SLOTS }, (_, i) => slot(deck.actives[i], `a${i}`))}
          </div>
          <span className="eyebrow">{t('deck.passives')} {deck.passives.length}/{maxPassives}</span>
          <div className="deck-grid">
            {PASSIVE_UNLOCK.map((lvl, i) => slot(deck.passives[i], `p${i}`, level >= lvl ? undefined : lvl))}
          </div>
          <p className="muted small">{t('deck.inLink')}</p>
        </div>

        <div className="panel">
          <h2>{t('deck.impactTitle')}</h2>
          {impactLines.length ? (
            <>
              <div className="row wrap deck-impact">
                {impactLines.map((l) => <span key={l.k} className={`tag ${l.neg ? 'neg' : ''}`}>{l.text}</span>)}
              </div>
              <p className="muted small">{t('deck.impactNote')}</p>
            </>
          ) : (
            <p className="muted">{t('deck.noImpact')}</p>
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
                    {focus.el === 'passive' ? t('deck.passive') : groupLabel(focus.el)}
                    {focus.lvl > 0 && ` · ${t('common.level', { n: focus.lvl })}`}
                    {focus.lvl > level && <span className="neg"> · {t('deck.notYet')}</span>}
                  </div>
                </div>
              </div>
              {(focusStats.length > 0 || focus.zero) && (
                <div className="row wrap deck-impact">
                  {focusStats.map(([k, v]) => <span key={k} className={`tag ${v < 0 ? 'neg' : ''}`}>{statLine(k, v)}</span>)}
                  {focus.zero?.map((k) => <span key={k} className="tag neg">{zeroLine(k)}</span>)}
                </div>
              )}
              <ul className="spell-text">
                {focus.text.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </>
          ) : (
            <p className="muted">{t('deck.hint')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
