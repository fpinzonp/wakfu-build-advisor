import { useMemo, useState } from 'react';
import {
  BUILD_SLOTS, EPIC, RELIC, SOCKET_COLORS,
  type BuildSlot, type EnchantData, type SocketColor, type Sublimation,
} from './lib/game';
import type { BuildRequest, BuildResult } from './lib/optimizer';
import { runeValue, type RuneGroup, type RunePlan } from './lib/runes';
import type { EnchantState } from './lib/share';
import { sublimationAffinity, sublimationBase } from './lib/sublimations';
import { pct, t } from './lib/i18n';

/** Texto del efecto en el idioma de la interfaz (si no hay traducción, el español). */
const subText = (s: Sublimation) => s.text ?? s.effect;

const slotLabel = (s: BuildSlot) => BUILD_SLOTS.find((x) => x.id === s)!.label;

// Sin color = engarce vacío (blanco).
export function Socket({ color, title }: { color?: SocketColor; title?: string }) {
  const c = color ? SOCKET_COLORS[color] : { label: t('socket.empty'), color: '#e8e8e8' };
  return <span className="socket" title={title ?? c.label} style={{ background: c.color }} />;
}

type Tab = 'normal' | 'epic' | 'relic';

export default function EnchantPanel({ data, result, request, enchant, onChange, suggested, groups, withMine }: {
  data: EnchantData | null; result: BuildResult; request: BuildRequest;
  enchant: EnchantState; onChange: (e: EnchantState) => void;
  suggested: RunePlan | null; groups: RuneGroup[]; withMine: BuildResult | null;
}) {
  const [tab, setTab] = useState<Tab>('normal');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(15);

  const subById = useMemo(() => new Map(data?.sublimations.map((s) => [s.id, s]) ?? []), [data]);
  const socketSlots = BUILD_SLOTS.map((s) => s.id).filter((s) => (result.slots[s]?.sockets ?? 0) >= 3);
  const epicItem = Object.values(result.slots).find((i) => i?.rarity === EPIC);
  const relicItem = Object.values(result.slots).find((i) => i?.rarity === RELIC);

  const reqKey = JSON.stringify({ ...request, excluded: [...request.excluded], locked: undefined });
  const focus = { crit: request.crit, back: request.back, berserk: request.berserk };
  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const subs = data.sublimations.filter((s) => s.kind === tab && s.effect.length > 0
      && (!q || s.name.toLowerCase().includes(q) || subText(s).join(' ').toLowerCase().includes(q)));
    // Las normales se agrupan por nombre base (I, II, III) mostrando el nivel más alto.
    const byBase = new Map<string, Sublimation[]>();
    for (const s of subs) {
      const key = tab === 'normal' ? sublimationBase(s.name) : s.name;
      byBase.set(key, [...(byBase.get(key) ?? []), s].sort((a, b) => a.level - b.level));
    }
    return [...byBase.values()]
      .map((variants) => {
        const top = variants[variants.length - 1];
        return { top, variants, affinity: sublimationAffinity(top, request.role, focus) };
      })
      .sort((a, b) => b.affinity - a.affinity || a.top.name.localeCompare(b.top.name));
    // focus deriva de request (reqKey)
  }, [data, tab, query, reqKey]);

  if (!data) return <div className="panel"><p className="muted">{t('enchant.loading')}</p></div>;

  const setRune = (slot: BuildSlot, index: number, shardId: number | null) => {
    const item = result.slots[slot]!;
    const count = groups.find((g) => g.slot === slot)?.sockets.length ?? 0;
    const prev = enchant.runes[slot]?.itemId === item.id ? enchant.runes[slot]!.shards : [];
    const shards = Array.from({ length: count }, (_, k) => prev[k] ?? null);
    shards[index] = shardId;
    onChange({ ...enchant, runes: { ...enchant.runes, [slot]: { itemId: item.id, shards } } });
  };
  const applySuggested = (only?: BuildSlot) => {
    const runes = { ...enchant.runes };
    for (const g of groups) {
      if (!only || g.slot === only) runes[g.slot] = { itemId: g.item.id, shards: g.sockets.map((s) => s.sug?.shard.id ?? null) };
    }
    onChange({ ...enchant, runes });
  };
  const setSub = (slot: BuildSlot, id: number | null) => {
    const subs = { ...enchant.subs };
    if (id === null) delete subs[slot]; else subs[slot] = id;
    onChange({ ...enchant, subs });
  };

  const chosenCount = groups.reduce((n, g) => n + g.sockets.filter((s) => s.mine).length, 0);
  const totalSockets = groups.reduce((n, g) => n + g.sockets.length, 0);
  const before = suggested?.before;
  const epicSub = enchant.epic != null ? subById.get(enchant.epic) : undefined;
  const relicSub = enchant.relic != null ? subById.get(enchant.relic) : undefined;
  const normalSubs = Object.entries(enchant.subs).filter(([s]) => result.slots[s as BuildSlot]);
  const selectedId = tab === 'epic' ? enchant.epic : tab === 'relic' ? enchant.relic : undefined;
  const host = tab === 'epic' ? epicItem : tab === 'relic' ? relicItem : null;

  return (
    <>
      <section className="panel enchant">
        <div className="panel-head">
          <div>
            <h2>{t('enchant.runes')}</h2>
            <p className="muted">{t('enchant.runesIntro', { n: chosenCount, total: totalSockets })}</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => applySuggested()}>{t('enchant.applyAll')}</button>
            {chosenCount > 0 && (
              <button className="btn ghost" onClick={() => onChange({ ...enchant, runes: {} })}>{t('enchant.clearAll')}</button>
            )}
          </div>
        </div>

        {before && suggested && (
          <div className="compare">
            <div>
              <span className="muted">{t('enchant.yourRunes')}</span>
              <b>{withMine ? pct((withMine.derived.output / before.derived.output - 1) * 100) : '—'}</b>
              <small>{t('enchant.outputEhp')} {withMine ? pct((withMine.derived.ehp / before.derived.ehp - 1) * 100) : '—'}</small>
            </div>
            <div>
              <span className="muted">{t('enchant.suggestedPlural')}</span>
              <b>{pct((suggested.after.derived.output / before.derived.output - 1) * 100)}</b>
              <small>{t('enchant.outputEhp')} {pct((suggested.after.derived.ehp / before.derived.ehp - 1) * 100)}</small>
            </div>
          </div>
        )}

        <div className="rune-grid">
          {groups.map((g) => (
            <div key={g.slot} className="rune-item">
              <div className="rune-item-head">
                <div>
                  <span className="eyebrow">{slotLabel(g.slot)}</span>
                  <div className="rune-item-name">{g.item.name}</div>
                </div>
                <button className="link" onClick={() => applySuggested(g.slot)}>{t('enchant.useSuggested')}</button>
              </div>
              {g.sockets.map((s, i) => {
                const same = s.mine && s.sug && s.mine.shard.id === s.sug.shard.id;
                return (
                  <div key={i} className="rune-socket">
                    <label className="rune-line">
                      <Socket color={s.mine?.color} />
                      <span className="sr-only">{t('enchant.socketAria', { n: i + 1, slot: slotLabel(g.slot) })}</span>
                      <select value={s.mine?.shard.id ?? ''}
                        onChange={(e) => setRune(g.slot, i, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">{t('socket.empty')}</option>
                        {data.shards.map((sh) => {
                          const v = runeValue(g.item, g.slot, sh);
                          return (
                            <option key={sh.id} value={sh.id}>
                              {SOCKET_COLORS[sh.color].label} · {sh.name} +{v.value}{v.doubled ? ' (×2)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    {s.forced && s.mine && s.mine.color !== s.forced && (
                      <div className="hint warn">{t('enchant.forcedColor', { color: SOCKET_COLORS[s.forced].label.toLowerCase() })}</div>
                    )}
                    {s.sug && !same && (
                      <div className="hint">
                        {t('enchant.suggested')}: <Socket color={s.sug.color} /> {s.sug.shard.name} +{s.sug.value}{s.sug.doubled && ' ×2'}
                        <button className="link" onClick={() => setRune(g.slot, i, s.sug!.shard.id)}>{t('common.change')}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="muted small">{t('enchant.runesNote')}</p>
      </section>

      <section className="panel enchant">
        <h2>{t('enchant.subs')}</h2>
        <div className="chosen-subs">
          <ChosenSub label={t('enchant.epic')} host={epicItem?.name} sub={epicSub} missing={t('enchant.noEpic')}
            onEdit={() => { setTab('epic'); setLimit(15); }} onClear={() => onChange({ ...enchant, epic: null })} />
          <ChosenSub label={t('enchant.relic')} host={relicItem?.name} sub={relicSub} missing={t('enchant.noRelic')}
            onEdit={() => { setTab('relic'); setLimit(15); }} onClear={() => onChange({ ...enchant, relic: null })} />
          {normalSubs.map(([slot, id]) => (
            <ChosenSub key={slot} label={slotLabel(slot as BuildSlot)} host={result.slots[slot as BuildSlot]!.name}
              sub={subById.get(id!)} onClear={() => setSub(slot as BuildSlot, null)} />
          ))}
        </div>

        <div className="seg" role="tablist">
          {([['normal', t('enchant.tab.normal')], ['epic', t('enchant.tab.epic')], ['relic', t('enchant.relic')]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}
              onClick={() => { setTab(id); setLimit(15); }}>{label}</button>
          ))}
        </div>

        <p className="muted small">
          {tab === 'normal'
            ? t('enchant.normalHint')
            : host
              ? <>{t(tab === 'epic' ? 'enchant.hostEpic' : 'enchant.hostRelic')} <b>{host.name}</b>. {t('enchant.onlyOne')}</>
              : <>{t(tab === 'epic' ? 'enchant.noEpic' : 'enchant.noRelic')} {t('enchant.cantUse')}</>}
        </p>

        <label className="field-inline">
          <span className="sr-only">{t('enchant.searchAria')}</span>
          <input type="search" className="input" placeholder={t('enchant.search')}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        <div className="sub-list">
          {list.slice(0, limit).map(({ top, variants, affinity }) => {
            const selected = selectedId === top.id;
            return (
              <article key={top.id} className={`sub-card ${selected ? 'selected' : ''}`}>
                <div className="sub-head">
                  <b>{tab === 'normal' ? sublimationBase(top.name) : top.name}</b>
                  {top.pattern.length > 0 && <span className="pattern">{top.pattern.map((c, i) => <Socket key={i} color={c} />)}</span>}
                  {affinity >= 2.5 && <span className="tag accent">{t('enchant.suggested')}</span>}
                  {selected && <span className="tag">{t('enchant.chosen')}</span>}
                  <div className="sub-action">
                    {tab === 'normal' ? (
                      <select aria-label={t('enchant.applyAria', { name: top.name })} value=""
                        onChange={(e) => { if (e.target.value) setSub(e.target.value as BuildSlot, top.id); }}>
                        <option value="">{t('enchant.applyTo')}</option>
                        {socketSlots.map((s) => (
                          <option key={s} value={s}>{slotLabel(s)}: {result.slots[s]!.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button className={`btn ${selected ? 'ghost' : ''}`} disabled={!host}
                        onClick={() => onChange({ ...enchant, [tab]: selected ? null : top.id })}>
                        {selected ? t('common.remove') : t('common.choose')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="sub-meta muted">
                  {variants.length > 1 && <>{t('enchant.levels', { list: variants.map((v) => v.level).join(' · ') })} · </>}
                  {top.stackable && top.maxLevel && <>{t('enchant.stackable', { n: top.maxLevel })} · </>}
                  {top.source && <>{t('enchant.source', { source: top.source })}</>}
                </div>
                <ul>{subText(top).map((e, i) => <li key={i}>{e}</li>)}</ul>
              </article>
            );
          })}
          {list.length > limit && (
            <button className="btn ghost" onClick={() => setLimit((l) => l + 20)}>{t('enchant.more', { n: list.length - limit })}</button>
          )}
          {list.length === 0 && <p className="muted">{t('enchant.none', { q: query })}</p>}
        </div>
        <p className="muted small">{t('enchant.note')} <a href="https://wakfu.wiki.gg/wiki/List_of_Sublimations" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).</p>
      </section>
    </>
  );
}

function ChosenSub({ label, host, sub, missing, onEdit, onClear }: {
  label: string; host?: string; sub?: Sublimation; missing?: string; onEdit?: () => void; onClear: () => void;
}) {
  return (
    <div className={`chosen-sub ${sub ? '' : 'empty'}`}>
      <span className="eyebrow">{label}{host && <> · {host}</>}</span>
      {!host && missing ? <span className="muted">{missing}</span> : sub ? (
        <>
          <b>{sub.name}</b>
          <span className="muted clamp">{subText(sub).join(' ')}</span>
        </>
      ) : <span className="muted">{t('enchant.notChosen')}</span>}
      <div className="row">
        {onEdit && host && <button className="link" onClick={onEdit}>{sub ? t('common.change') : t('common.choose')}</button>}
        {sub && <button className="link" onClick={onClear}>{t('common.remove')}</button>}
      </div>
    </div>
  );
}
